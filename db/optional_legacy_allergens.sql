-- Applied after scheduled meal schema. Existing values are retained for compatibility.
alter table public.meal_offers alter column allergens drop not null;
