-- BizOs initial schema (generated from 05_BACKEND_SCHEMA.md)
-- Run once in the Supabase SQL editor (or as a migration). Order matters.
-- Launch access is ON by default: every business gets Pro entitlements.

create extension if not exists "pgcrypto";

create type member_role as enum ('owner', 'staff');
create type payment_method as enum ('cash', 'transfer', 'pos');
create type sale_payment_type as enum ('cash', 'transfer', 'pos', 'credit', 'part');
create type stock_reason as enum ('opening', 'restock', 'sale', 'void', 'damage', 'correction');
create type plan_tier as enum ('free', 'pro');

-- Businesses
create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  logo_url text,
  receipt_note text default 'Thank you for your patronage',
  allow_negative_stock boolean not null default true,
  low_stock_default int not null default 5,
  receipt_counter int not null default 0,
  plan plan_tier not null default 'free',
  plan_expires_at timestamptz,
  founding_member boolean not null default false,
  created_at timestamptz not null default now()
);

-- Membership and roles
create table business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  role member_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);
create index on business_members (user_id);

-- Products
create table products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  category text,
  cost_price numeric(14,2) not null default 0 check (cost_price >= 0),
  selling_price numeric(14,2) not null check (selling_price >= 0),
  stock_qty numeric(14,2) not null default 0,
  low_stock_level numeric(14,2) not null default 5,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on products (business_id, is_archived);
create unique index products_name_unique on products (business_id, lower(name)) where not is_archived;

-- Stock movement log
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  change_qty numeric(14,2) not null,
  reason stock_reason not null,
  note text,
  sale_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on stock_movements (product_id, created_at desc);

-- Customers
create table customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);
create index on customers (business_id, name);

-- Sales
create table sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid not null,
  receipt_no text not null,
  customer_id uuid references customers(id),
  payment_type sale_payment_type not null,
  subtotal numeric(14,2) not null,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null,
  amount_paid numeric(14,2) not null default 0,
  is_voided boolean not null default false,
  void_reason text,
  voided_by uuid references auth.users(id),
  needs_review boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (business_id, client_id),
  unique (business_id, receipt_no),
  check (amount_paid >= 0 and amount_paid <= total)
);
create index on sales (business_id, created_at desc);
create index on sales (customer_id) where customer_id is not null;

-- Sale line items (price and cost frozen at time of sale)
create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  product_id uuid not null references products(id),
  product_name text not null,
  qty numeric(14,2) not null check (qty > 0),
  unit_price numeric(14,2) not null,
  unit_cost numeric(14,2) not null default 0,
  line_total numeric(14,2) not null
);
create index on sale_items (sale_id);

-- Payments (at sale time or later repayments)
create table payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid references customers(id),
  sale_id uuid references sales(id),
  amount numeric(14,2) not null check (amount > 0),
  method payment_method not null default 'cash',
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index on payments (customer_id, created_at desc);

-- Is the current user a member of this business?
create or replace function is_member(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from business_members
    where business_id = b and user_id = auth.uid() and is_active
  );
$$;

-- Is the current user the owner of this business?
create or replace function is_owner(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from business_members
    where business_id = b and user_id = auth.uid() and role = 'owner' and is_active
  );
$$;

alter table businesses        enable row level security;
alter table business_members  enable row level security;
alter table products          enable row level security;
alter table stock_movements   enable row level security;
alter table customers         enable row level security;
alter table sales             enable row level security;
alter table sale_items        enable row level security;
alter table payments          enable row level security;

-- Businesses
create policy "members read business" on businesses
  for select using (is_member(id));
create policy "owner updates business" on businesses
  for update using (is_owner(id));

-- Members
create policy "members read members" on business_members
  for select using (is_member(business_id));
create policy "owner manages members" on business_members
  for all using (is_owner(business_id)) with check (is_owner(business_id));

-- Products: staff can read, only owner can write directly
create policy "members read products" on products
  for select using (is_member(business_id));
create policy "owner writes products" on products
  for all using (is_owner(business_id)) with check (is_owner(business_id));

-- Stock movements: read by members; writes only through RPCs
create policy "members read stock movements" on stock_movements
  for select using (is_member(business_id));

-- Customers: members can read and add; owner can edit or delete
create policy "members read customers" on customers
  for select using (is_member(business_id));
create policy "members add customers" on customers
  for insert with check (is_member(business_id));
create policy "owner edits customers" on customers
  for update using (is_owner(business_id));
create policy "owner deletes customers" on customers
  for delete using (is_owner(business_id));

-- Sales: owner sees all, staff sees own; writes only through RPCs
create policy "owner reads all sales" on sales
  for select using (is_owner(business_id));
create policy "staff reads own sales" on sales
  for select using (is_member(business_id) and created_by = auth.uid());

create policy "read sale items with sale" on sale_items
  for select using (
    exists (select 1 from sales s where s.id = sale_id)
  );

-- Payments: owner sees all, staff sees own
create policy "owner reads payments" on payments
  for select using (is_owner(business_id));
create policy "staff reads own payments" on payments
  for select using (is_member(business_id) and created_by = auth.uid());

create or replace function create_business(p_name text, p_phone text, p_address text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  insert into businesses (name, phone, address, founding_member)
  values (p_name, p_phone, p_address, launch_active())
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

create or replace function record_payment(
  p_business_id uuid,
  p_customer_id uuid,
  p_amount numeric,
  p_method payment_method,
  p_note text default null
) returns numeric   -- returns remaining balance
language plpgsql security definer set search_path = public as $$
declare
  v_remaining numeric := p_amount;
  v_sale record;
  v_apply numeric;
  v_balance numeric;
begin
  if not is_member(p_business_id) then
    raise exception 'Not a member of this business';
  end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;

  for v_sale in
    select id, total, amount_paid from sales
    where business_id = p_business_id and customer_id = p_customer_id
      and is_voided = false and amount_paid < total
    order by created_at asc
    for update
  loop
    exit when v_remaining <= 0;
    v_apply := least(v_remaining, v_sale.total - v_sale.amount_paid);

    update sales set amount_paid = amount_paid + v_apply where id = v_sale.id;

    insert into payments (business_id, customer_id, sale_id, amount, method, note, created_by)
    values (p_business_id, p_customer_id, v_sale.id, v_apply, p_method, p_note, auth.uid());

    v_remaining := v_remaining - v_apply;
  end loop;

  if v_remaining > 0 then
    raise exception 'Payment exceeds outstanding balance by %', v_remaining;
  end if;

  select coalesce(sum(total - amount_paid), 0) into v_balance
  from sales
  where business_id = p_business_id and customer_id = p_customer_id and is_voided = false;

  return v_balance;
end;
$$;

create or replace function void_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sale sales;
  v_item sale_items;
begin
  select * into v_sale from sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if not is_owner(v_sale.business_id) then raise exception 'Owner only'; end if;
  if v_sale.is_voided then return; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Reason required'; end if;

  update sales
  set is_voided = true, void_reason = p_reason, voided_by = auth.uid()
  where id = p_sale_id;

  for v_item in select * from sale_items where sale_id = p_sale_id loop
    update products set stock_qty = stock_qty + v_item.qty, updated_at = now()
    where id = v_item.product_id;

    insert into stock_movements (business_id, product_id, change_qty, reason, sale_id, note, created_by)
    values (v_sale.business_id, v_item.product_id, v_item.qty, 'void', p_sale_id, p_reason, auth.uid());
  end loop;
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

  update products
  set stock_qty = stock_qty + p_change,
      cost_price = coalesce(p_new_cost, cost_price),
      updated_at = now()
  where id = p_product_id;

  insert into stock_movements (business_id, product_id, change_qty, reason, note, created_by)
  values (v_product.business_id, p_product_id, p_change, p_reason, p_note, auth.uid());
end;
$$;

create or replace function report_summary(
  p_business_id uuid, p_start timestamptz, p_end timestamptz
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
  v_max jsonb;
begin
  if not is_owner(p_business_id) then raise exception 'Owner only'; end if;

  -- Plan limit: maximum report range in days (null = unlimited)
  v_max := limit_of(p_business_id, 'report_max_days');
  if v_max is not null and jsonb_typeof(v_max) = 'number'
     and (p_end - p_start) > make_interval(days => (v_max #>> '{}')::int) then
    raise exception 'PLAN_LIMIT:report_range';
  end if;

  select jsonb_build_object(
    'total_sales',   coalesce(sum(s.total), 0),
    'sales_count',   count(*),
    'avg_sale',      coalesce(avg(s.total), 0),
    'collected',     coalesce(sum(s.amount_paid), 0),
    'outstanding',   coalesce(sum(s.total - s.amount_paid), 0),
    'profit', case when coalesce((limit_of(p_business_id, 'profit_report'))::boolean, false) then coalesce((
      select sum((i.unit_price - i.unit_cost) * i.qty)
      from sale_items i join sales s2 on s2.id = i.sale_id
      where s2.business_id = p_business_id and s2.is_voided = false
        and s2.created_at between p_start and p_end
    ), 0) else null end
  ) into result
  from sales s
  where s.business_id = p_business_id and s.is_voided = false
    and s.created_at between p_start and p_end;

  return result;
end;
$$;

-- Plan definitions (limits are JSON; null = unlimited)
create table plans (
  tier plan_tier primary key,
  name text not null,
  price_ngn_monthly numeric(14,2),
  limits jsonb not null
);

insert into plans (tier, name, price_ngn_monthly, limits) values
('free', 'Free', 0, '{
  "max_products": 50,
  "max_staff": 0,
  "report_max_days": 7,
  "profit_report": false,
  "receipt_branding": false
}'),
('pro', 'Pro', null, '{
  "max_products": null,
  "max_staff": 5,
  "report_max_days": null,
  "profit_report": true,
  "receipt_branding": true
}');

-- Global switches
create table app_settings (
  key text primary key,
  value jsonb not null
);

-- LAUNCH MODE ON: everyone gets Pro entitlements, no end date yet
insert into app_settings (key, value)
values ('launch_access', '{"enabled": true, "ends_at": null}');

alter table plans enable row level security;
alter table app_settings enable row level security;
create policy "anyone signed in reads plans" on plans
  for select to authenticated using (true);
create policy "anyone signed in reads settings" on app_settings
  for select to authenticated using (true);
-- No insert/update/delete policies: changes are made by you in the SQL editor
-- (or with the service role), never from the app.

-- Is launch access active right now?
create or replace function launch_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (value->>'enabled')::boolean
       and (value->>'ends_at' is null or (value->>'ends_at')::timestamptz > now())
    from app_settings where key = 'launch_access'
  ), false);
$$;

-- The tier a business actually gets right now
create or replace function effective_tier(b uuid) returns plan_tier
language sql stable security definer set search_path = public as $$
  select case
    when launch_active() then 'pro'::plan_tier
    when bz.plan = 'pro' and (bz.plan_expires_at is null or bz.plan_expires_at > now())
      then 'pro'::plan_tier
    else 'free'::plan_tier
  end
  from businesses bz where bz.id = b;
$$;

-- One limit value for a business (jsonb: number, boolean, or null)
create or replace function limit_of(b uuid, k text) returns jsonb
language sql stable security definer set search_path = public as $$
  select limits -> k from plans where tier = effective_tier(b);
$$;

-- Everything the client needs to show/hide features
create or replace function get_entitlements(b uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  t plan_tier;
  l jsonb;
  s jsonb;
begin
  if not is_member(b) then raise exception 'Not a member of this business'; end if;
  t := effective_tier(b);
  select limits into l from plans where tier = t;
  select value into s from app_settings where key = 'launch_access';
  return jsonb_build_object(
    'tier', t,
    'launch_access', launch_active(),
    'launch_ends_at', s->>'ends_at',
    'limits', l
  );
end;
$$;

-- Enforce the product limit (blocks NEW products only; existing ones stay)
create or replace function enforce_product_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  lim jsonb;
  cnt int;
begin
  lim := limit_of(new.business_id, 'max_products');
  if lim is null or jsonb_typeof(lim) = 'null' then return new; end if;
  select count(*) into cnt from products
  where business_id = new.business_id and not is_archived;
  if cnt >= (lim #>> '{}')::int then
    raise exception 'PLAN_LIMIT:max_products';
  end if;
  return new;
end;
$$;
create trigger products_limit before insert on products
  for each row execute function enforce_product_limit();

-- Enforce the staff limit (owners are not counted)
create or replace function enforce_staff_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  lim jsonb;
  cnt int;
begin
  if new.role <> 'staff' then return new; end if;
  lim := limit_of(new.business_id, 'max_staff');
  if lim is null or jsonb_typeof(lim) = 'null' then return new; end if;
  select count(*) into cnt from business_members
  where business_id = new.business_id and role = 'staff';
  if cnt >= (lim #>> '{}')::int then
    raise exception 'PLAN_LIMIT:max_staff';
  end if;
  return new;
end;
$$;
create trigger staff_limit before insert on business_members
  for each row execute function enforce_staff_limit();

-- After launch ends: keep the oldest N staff active, deactivate the rest (never delete)
create or replace function apply_plan_limits(b uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  lim jsonb;
  n int;
begin
  update business_members set is_active = true where business_id = b and role = 'owner';
  lim := limit_of(b, 'max_staff');
  if lim is null or jsonb_typeof(lim) = 'null' then
    update business_members set is_active = true where business_id = b;
    return;
  end if;
  n := (lim #>> '{}')::int;
  update business_members m
  set is_active = (r.rn <= n)
  from (
    select id, row_number() over (order by created_at) as rn
    from business_members where business_id = b and role = 'staff'
  ) r
  where m.id = r.id;
end;
$$;

-- Customer balances
create or replace view customer_balances as
select c.id as customer_id, c.business_id, c.name, c.phone,
       coalesce(sum(s.total - s.amount_paid) filter (where s.is_voided = false), 0) as balance,
       min(s.created_at) filter (where s.amount_paid < s.total and s.is_voided = false) as oldest_debt_at
from customers c
left join sales s on s.customer_id = c.id
group by c.id;

-- Low stock
create or replace view low_stock_products as
select * from products
where is_archived = false and stock_qty <= low_stock_level;

-- Views must respect RLS of the querying user
alter view customer_balances set (security_invoker = true);
alter view low_stock_products set (security_invoker = true);
