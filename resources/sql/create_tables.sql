CREATE TABLE present (
    present_id SERIAL PRIMARY KEY,
    present_name VARCHAR(255),
    address VARCHAR(255),
    point GEOMETRY(POINT)
);

CREATE TABLE delivery_route (
    id SERIAL PRIMARY KEY,
    facility_id INT,
    delivery_ordered_point GEOMETRY(LINESTRING),
    route_flex_polylines TEXT
);

CREATE TABLE facility (
    facility_id SERIAL PRIMARY KEY,
    facility_name VARCHAR(255),
    address VARCHAR(255),
    point GEOMETRY(POINT)
);

SELECT * FROM information_schema.tables WHERE table_schema = 'public';

INSERT INTO facility (facility_name, address, point) VALUES ('サンタさんの家', '宮城県仙台市青葉区中央１丁目１−１', ST_GeomFromText('POINT(38.260990 140.881155)'));
