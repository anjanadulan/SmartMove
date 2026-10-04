SET SERVEROUTPUT ON;

CREATE OR REPLACE PROCEDURE popular_routes
AS
    CURSOR cur_routes IS
        SELECT r.route_name, COUNT(t.ticket_id) AS tickets_sold
        FROM routes r
        JOIN trips tr ON r.route_id = tr.route_id
        JOIN bookings b ON tr.trip_id = b.trip_id
        JOIN tickets t ON b.booking_id = t.booking_id
        WHERE t.status = 'ISSUED'
        GROUP BY r.route_name
        ORDER BY tickets_sold DESC;
BEGIN
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
    DBMS_OUTPUT.PUT_LINE('POPULAR ROUTES REPORT');
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
    FOR rec IN cur_routes LOOP
        DBMS_OUTPUT.PUT_LINE(rec.route_name || ' : ' || rec.tickets_sold || ' tickets');
    END LOOP;
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
END popular_routes;
/

CREATE OR REPLACE PROCEDURE revenue
AS
    v_total_payments NUMBER := 0;
    v_total_refunds NUMBER := 0;
    v_net_revenue NUMBER := 0;
BEGIN
    SELECT NVL(SUM(amount), 0)
    INTO v_total_payments
    FROM payments;

    SELECT NVL(SUM(amount), 0)
    INTO v_total_refunds
    FROM refunds;

    v_net_revenue := v_total_payments - v_total_refunds;

    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
    DBMS_OUTPUT.PUT_LINE('REVENUE REPORT');
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
    DBMS_OUTPUT.PUT_LINE('Total Payments : LKR ' || v_total_payments);
    DBMS_OUTPUT.PUT_LINE('Total Refunds  : LKR ' || v_total_refunds);
    DBMS_OUTPUT.PUT_LINE('Net Revenue    : LKR ' || v_net_revenue);
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
END revenue;
/

CREATE OR REPLACE PROCEDURE passenger_history (
    p_passenger_id IN NUMBER
)
AS
    CURSOR cur_history IS
        SELECT b.booking_id, r.route_name, t.seat_number, t.fare_amount, b.status
        FROM bookings b
        JOIN trips tr ON b.trip_id = tr.trip_id
        JOIN routes r ON tr.route_id = r.route_id
        JOIN tickets t ON b.booking_id = t.booking_id
        WHERE b.passenger_id = p_passenger_id
        ORDER BY b.booking_id, t.ticket_id;
    v_passenger_name passengers.full_name%TYPE;
BEGIN
    SELECT full_name
    INTO v_passenger_name
    FROM passengers
    WHERE passenger_id = p_passenger_id;

    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
    DBMS_OUTPUT.PUT_LINE('PASSENGER TRAVEL HISTORY: ' || v_passenger_name);
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
    FOR rec IN cur_history LOOP
        DBMS_OUTPUT.PUT_LINE('Booking ' || rec.booking_id || ' | ' || rec.route_name || 
                             ' | Seat: ' || rec.seat_number || ' | Status: ' || rec.status);
    END LOOP;
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        DBMS_OUTPUT.PUT_LINE('Passenger ID ' || p_passenger_id || ' not found.');
END passenger_history;
/

CREATE OR REPLACE PROCEDURE maintenance_due (
    p_as_of IN DATE
)
AS
    CURSOR cur_maintenance IS
        SELECT m.maintenance_id, v.registration_number, m.maintenance_type, m.scheduled_date
        FROM maintenance_records m
        JOIN vehicles v ON m.vehicle_id = v.vehicle_id
        WHERE m.status = 'SCHEDULED'
          AND m.scheduled_date <= TRUNC(p_as_of) + 1
        ORDER BY m.scheduled_date;
    rec cur_maintenance%ROWTYPE;
BEGIN
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
    DBMS_OUTPUT.PUT_LINE('MAINTENANCE DUE REPORT');
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
    OPEN cur_maintenance;
    LOOP
        FETCH cur_maintenance INTO rec;
        EXIT WHEN cur_maintenance%NOTFOUND;
        DBMS_OUTPUT.PUT_LINE('Record ' || rec.maintenance_id || ' | Vehicle: ' || 
                             rec.registration_number || ' | ' || rec.maintenance_type || 
                             ' | Due: ' || TO_CHAR(rec.scheduled_date, 'YYYY-MM-DD'));
    END LOOP;
    CLOSE cur_maintenance;
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
END maintenance_due;
/

CREATE OR REPLACE PROCEDURE trip_occupancy
AS
    CURSOR cur_trips IS
        SELECT t.trip_id, r.route_name, v.seat_count
        FROM trips t
        JOIN routes r ON t.route_id = r.route_id
        JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        ORDER BY t.trip_id;
    v_occupied_seats NUMBER;
    v_occupancy_pct NUMBER;
BEGIN
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
    DBMS_OUTPUT.PUT_LINE('TRIP OCCUPANCY REPORT');
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
    FOR rec IN cur_trips LOOP
        SELECT COUNT(*)
        INTO v_occupied_seats
        FROM tickets t
        JOIN bookings b ON t.booking_id = b.booking_id
        WHERE b.trip_id = rec.trip_id
          AND t.status = 'ISSUED';

        IF rec.seat_count > 0 THEN
            v_occupancy_pct := ROUND((v_occupied_seats * 100) / rec.seat_count, 2);
        ELSE
            v_occupancy_pct := 0;
        END IF;

        DBMS_OUTPUT.PUT_LINE('Trip ' || rec.trip_id || ' (' || rec.route_name || ') : ' || 
                             v_occupied_seats || '/' || rec.seat_count || ' seats (' || 
                             v_occupancy_pct || '%)');
    END LOOP;
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
END trip_occupancy;
/
