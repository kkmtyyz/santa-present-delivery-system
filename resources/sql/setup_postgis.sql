/* 
ref: https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/AuroraUserGuide/Appendix.PostgreSQL.CommonDBATasks.PostGIS.html
*/

-- PostGIS 拡張機能を管理する別のロール (ユーザー) を作成します。
CREATE ROLE gis_admin LOGIN PASSWORD 'change_me';

-- このロールに rds_superuser 権限を付与して、ロールが拡張機能をインストールできるようにします。
GRANT rds_superuser TO gis_admin;

-- CREATE EXTENSION ステートメントを使用して PostGIS エクステンションをロードします。
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_raster;
CREATE EXTENSION fuzzystrmatch;
CREATE EXTENSION postgis_tiger_geocoder;
CREATE EXTENSION postgis_topology;
CREATE EXTENSION address_standardizer_data_us;

-- ALTER SCHEMA ステートメント使用して、gis_admin ロールにスキーマの所有権を移転します。
ALTER SCHEMA tiger OWNER TO gis_admin;
ALTER SCHEMA tiger_data OWNER TO gis_admin; 
ALTER SCHEMA topology OWNER TO gis_admin;

-- gis_admin ロールに PostGIS テーブルの所有権を移管します。
CREATE FUNCTION exec(text) returns text language plpgsql volatile AS $f$ BEGIN EXECUTE $1; RETURN $1; END; $f$;

-- exec 関数を実行すると、ステートメントが実行されてアクセス許可が変更されます。
SELECT exec('ALTER TABLE ' || quote_ident(s.nspname) || '.' || quote_ident(s.relname) || ' OWNER TO gis_admin;')
  FROM (
    SELECT nspname, relname
    FROM pg_class c JOIN pg_namespace n ON (c.relnamespace = n.oid) 
    WHERE nspname in ('tiger','topology') AND
    relkind IN ('r','S','v') ORDER BY relkind = 'S')
s;

-- スキーマ名の指定を不要とするには、次のコマンドを使用して検索パスに tiger スキーマを追加します。
SET search_path=public,tiger;


/*
ref: https://postgis.net/docs/ja/PostGIS_Version.html
*/
SELECT PostGIS_Version();




