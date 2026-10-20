-- Synthetic volume for load testing: 20,000 trials and 50,000 consents on one trial.
-- psql "$DATABASE_URL" -v researcher=0xlowercasewalletaddress -f scripts/seed-load.sql
insert into trials(id, researcher, title, criteria, consents, open, block)
select g, case when g = 1000 then :'researcher' else '0x' || lpad(to_hex(g % 500), 40, '0') end,
       'Study ' || g || ' in ' || (array['Fabry','Gaucher','Pompe','Duchenne','Huntington'])[1 + g % 5] || ' disease',
       '["0x0000000000000000000000000000000000000000000000000000000000000001"]'::jsonb, case when g = 1000 then 50000 else 0 end, true, 0
from generate_series(1000, 20999) g on conflict do nothing;
insert into trial_meta(trial_id, researcher, data)
select id, researcher, jsonb_build_object('title', title, 'conditions', (array['Fabry disease','Gaucher disease','Pompe disease','Duchenne muscular dystrophy','Huntington''s disease'])[1 + id % 5],
       'summary', 'Synthetic trial used for load testing.', 'sponsor', 'Load Test Sponsor', 'phase', 'Phase 2', 'ageMin', '18', 'duration', '12 months')
from trials where id >= 1000 on conflict do nothing;
insert into consents(trial_id, patient, block, tx)
select 1000, '0x' || lpad(to_hex(g), 40, '0'), 0, '0x' from generate_series(1, 50000) g on conflict do nothing;
analyze trials; analyze trial_meta; analyze consents;
