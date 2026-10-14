-- Security hardening (run AFTER 001_init.sql and 002_staff_invites.sql).
--
-- Fixes found in the audit:
--   1. create_business had no auth check: an anonymous caller could create
--      businesses. record_sale/adjust_stock accepted negative qty/discount.
--   2. Postgres grants EXECUTE on new functions to PUBLIC by default, so the
--      anon role could invoke every RPC. Restrict to authenticated.
--   3. RLS "owner updates business" allowed owners to overwrite ANY column,
--      including plan / plan_expires_at / receipt_counter (free self-upgrade,
--      receipt forgery). Same for stock_qty on products (stock changes must
--      go through adjust_stock so the movement ledger stays complete).

-- ---------------------------------------------------------------------------
-- 1. Stricter input validation in existing RPCs
-- ---------------------------------------------------------------------------

create or replace function create_business(p_name text, p_phone text, p_address text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Business name required';
  end if;

  insert into businesses (name, phone, address, founding_member)
  values (trim(p_name), p_phone, p_address, launch_active())
  returning id into new_id;

  insert into business_members (business_id, user_id, role)
  values (new_id, auth.uid(), 'owner');

  return new_id;
end;
$$;

create or replace function record_sale(
  p_business_id uuid,
  p_client_id uuid,
  p_customer_id uuid,
  p_payment_type sale_payment_type,
  p_discount numeric,
  p_amount_paid numeric,
  p_items jsonb,            -- [{product_id, qty}]
  p_created_at timestamptz default now()
) returns sales
language plpgsql security definer set search_path = public as $$
declare
  v_sale sales;
  v_item jsonb;
  v_product products;
  v_qty numeric;
  v_subtotal numeric := 0;
  v_total numeric;
  v_paid numeric;
  v_receipt text;
  v_review boolean := false;
begin
  if not is_member(p_business_id) then
    raise exception 'Not a member of this business';
  end if;
  if coalesce(p_discount, 0) < 0 then
    raise exception 'Discount cannot be negative';
  end if;
  if coalesce(p_amount_paid, 0) < 0 then
    raise exception 'Amount paid cannot be negative';
  end if;

  -- Idempotency: return existing sale for the same client_id
  select * into v_sale from sales
  where business_id = p_business_id and client_id = p_client_id;
  if found then
    return v_sale;
  end if;

  if p_payment_type in ('credit', 'part') and p_customer_id is null then
    raise exception 'Customer required for credit or part payment';
  end if;

  -- Compute subtotal from server-side prices
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products
    where id = (v_item->>'product_id')::uuid and business_id = p_business_id
    for update;
    if not found then raise exception 'Product not found'; end if;
    v_qty := (v_item->>'qty')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity must be greater than zero';
    end if;
    v_subtotal := v_subtotal + (v_product.selling_price * v_qty);
  end loop;

  v_total := greatest(v_subtotal - coalesce(p_discount, 0), 0);

  v_paid := case p_payment_type
    when 'credit' then 0
    when 'part'   then least(coalesce(p_amount_paid, 0), v_total)
    else v_total
  end;

  -- Receipt number: BIZ-YYYYMM-####
  update businesses set receipt_counter = receipt_counter + 1
  where id = p_business_id
  returning 'BIZ-' || to_char(now(), 'YYYYMM') || '-' || lpad(receipt_counter::text, 4, '0')
  into v_receipt;

  insert into sales (business_id, client_id, receipt_no, customer_id, payment_type,
                     subtotal, discount, total, amount_paid, created_by, created_at)
  values (p_business_id, p_client_id, v_receipt, p_customer_id, p_payment_type,
          v_subtotal, coalesce(p_discount, 0), v_total, v_paid, auth.uid(), p_created_at)
  returning * into v_sale;

  -- Line items and stock deduction
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products
    where id = (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'qty')::numeric;

    insert into sale_items (sale_id, business_id, product_id, product_name,
                            qty, unit_price, unit_cost, line_total)
    values (v_sale.id, p_business_id, v_product.id, v_product.name,
            v_qty, v_product.selling_price, v_product.cost_price,
            v_product.selling_price * v_qty);

    update products
    set stock_qty = stock_qty - v_qty, updated_at = now()
    where id = v_product.id;

    if v_product.stock_qty - v_qty < 0 then v_review := true; end if;

    insert into stock_movements (business_id, product_id, change_qty, reason, sale_id, created_by)
    values (p_business_id, v_product.id, -v_qty, 'sale', v_sale.id, auth.uid());
  end loop;

  if v_review then
    update sales set needs_review = true where id = v_sale.id;
  end if;

  -- Record payment made at the time of sale
  if v_paid > 0 then
    insert into payments (business_id, customer_id, sale_id, amount, method, created_by)
    values (p_business_id, p_customer_id, v_sale.id, v_paid,
            case when p_payment_type in ('transfer', 'pos')
                 then p_payment_type::text::payment_method
                 else 'cash' end,
            auth.uid());
  end if;

  select * into v_sale from sales where id = v_sale.id;
  return v_sale;
end;
$$;

create or replace function adjust_stock(
  p_product_id uuid,
  p_change numeric,
  p_reason stock_reason,
  p_note text default null,
  p_new_cost numeric default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_product products;
begin
  select * into v_product from products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if not is_owner(v_product.business_id) then raise exception 'Owner only'; end if;
  if p_reason in ('sale', 'void') then raise exception 'Invalid reason'; end if;
  if p_change is null or p_change = 0 then raise exception 'Change cannot be zero'; end if;
  if p_new_cost is not null and p_new_cost < 0 then raise exception 'Cost price cannot be negative'; end if;

  update products
  set stock_qty = stock_qty + p_change,
      cost_price = coalesce(p_new_cost, cost_price),
      updated_at = now()
  where id = p_product_id;

  insert into stock_movements (business_id, product_id, change_qty, reason, note, created_by)
  values (v_product.business_id, p_product_id, p_change, p_reason, p_note, auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Lock down function execution: authenticated only (never anon/public)
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Column-level write restrictions
--    RLS controls WHO can write; column grants control WHAT they can write.
--    All RPCs are security definer (they run as the function owner), so
--    record_sale / adjust_stock / create_business are unaffected.
-- ---------------------------------------------------------------------------

-- Owners may edit shop identity and behaviour, but never the plan,
-- the founding-member flag, or the receipt counter (receipt numbering).
revoke update on businesses from authenticated, anon;
grant update (name, phone, address, logo_url, receipt_note,
              allow_negative_stock, low_stock_default)
  on businesses to authenticated;

-- Owners may only activate/deactivate members. Role and user_id changes are
-- not client operations (claim_invites / create_business are definer RPCs).
revoke update on business_members from authenticated, anon;
grant update (is_active) on business_members to authenticated;

-- Owners may edit product details, but stock_qty only changes through
-- adjust_stock / record_sale / void_sale so the ledger stays complete.
revoke update on products from authenticated, anon;
grant update (name, category, cost_price, selling_price,
              low_stock_level, is_archived, updated_at)
  on products to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The anon role has no business touching app tables at all
--    (login/signup go through the auth API, which is separate).
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke usage on all sequences in schema public from anon;
