-- Executed by the postgres image on first start only (empty data volume).
-- Automated tests use a separate database so they can truncate tables freely.
CREATE DATABASE ecp_test;
