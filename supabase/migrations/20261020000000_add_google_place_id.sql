-- Stores which Google Maps listing a business is, so ratings and local rankings no longer depend on where the owner
-- happened to be when they signed up. The server writes these columns after it has looked the place up on Google;
-- browser roles can read them through the existing table-wide select grant but cannot write them.
alter table public.businesses add column if not exists google_place_id varchar(255);
alter table public.businesses add column if not exists google_place_name varchar(300);
alter table public.businesses add column if not exists google_place_address varchar(500);
