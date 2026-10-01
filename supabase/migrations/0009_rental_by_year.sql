begin;
alter table public.tenancy_agreements
 add column monthly_rental_year_2 numeric(12,2) check (monthly_rental_year_2 >= 0),
 add column monthly_rental_year_3 numeric(12,2) check (monthly_rental_year_3 >= 0);
comment on column public.tenancy_agreements.monthly_rental is 'Year 1 monthly rental in RM; existing values preserved';
notify pgrst, 'reload schema';
commit;
