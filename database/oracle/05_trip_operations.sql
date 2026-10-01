SET SERVEROUTPUT ON;

CREATE OR REPLACE PROCEDURE reschedule_trip (
    p_id IN NUMBER,
    p_vehicle_id IN NUMBER,
    p_driver_id IN NUMBER,
    p_departure IN DATE,
    p_arrival IN DATE
)
AS
    v_booking_count NUMBER;
    v_vehicle_status vehicles.status%TYPE;
    v_conflict_count NUMBER;
    ex_invalid_change EXCEPTION;
BEGIN
    SELECT COUNT(*)
    INTO v_booking_count
    FROM bookings
    WHERE trip_id = p_id;

    IF v_booking_count > 0 OR p_departure IS NULL OR p_arrival IS NULL
       OR p_departure <= SYSDATE OR p_arrival <= p_departure THEN
        RAISE ex_invalid_change;
    END IF;

    SELECT status
    INTO v_vehicle_status
    FROM vehicles
    WHERE vehicle_id = p_vehicle_id;

    SELECT COUNT(*)
    INTO v_conflict_count
    FROM trips
    WHERE trip_id <> p_id
      AND status = 'SCHEDULED'
      AND (vehicle_id = p_vehicle_id OR driver_id = p_driver_id)
      AND departure_at < p_arrival
      AND arrival_at > p_departure;

    IF v_vehicle_status <> 'ACTIVE' OR v_conflict_count > 0 THEN
        RAISE ex_invalid_change;
    END IF;

    SELECT COUNT(*)
    INTO v_conflict_count
    FROM maintenance_records
    WHERE vehicle_id = p_vehicle_id
      AND status = 'SCHEDULED'
      AND TRUNC(scheduled_date) < p_arrival
      AND TRUNC(scheduled_date) + 1 > p_departure;

    IF v_conflict_count > 0 THEN
        RAISE ex_invalid_change;
    END IF;

    UPDATE trips
    SET vehicle_id = p_vehicle_id,
        driver_id = p_driver_id,
        departure_at = p_departure,
        arrival_at = p_arrival
    WHERE trip_id = p_id;

    DBMS_OUTPUT.PUT_LINE('Trip rescheduled successfully: ' || p_id);
EXCEPTION
    WHEN ex_invalid_change THEN
        DBMS_OUTPUT.PUT_LINE('Error: Cannot reschedule trip. Check bookings or vehicle/driver availability.');
        RAISE;
END reschedule_trip;
/

CREATE OR REPLACE PROCEDURE cancel_trip (p_id IN NUMBER)
AS
    v_trip_status trips.status%TYPE;
    ex_cannot_cancel EXCEPTION;
BEGIN
    SELECT status
    INTO v_trip_status
    FROM trips
    WHERE trip_id = p_id;

    IF v_trip_status = 'CANCELLED' THEN
        RAISE ex_cannot_cancel;
    END IF;

    UPDATE tickets
    SET status = 'CANCELLED'
    WHERE booking_id IN (
        SELECT booking_id FROM bookings WHERE trip_id = p_id
    );

    UPDATE bookings
    SET status = 'CANCELLED'
    WHERE trip_id = p_id;

    UPDATE trips
    SET status = 'CANCELLED'
    WHERE trip_id = p_id;

    DBMS_OUTPUT.PUT_LINE('Trip cancelled: ' || p_id);
EXCEPTION
    WHEN ex_cannot_cancel THEN
        DBMS_OUTPUT.PUT_LINE('Error: Trip is already cancelled.');
        RAISE;
END cancel_trip;
/

CREATE OR REPLACE PROCEDURE complete_trip (p_id IN NUMBER)
AS
    v_status trips.status%TYPE;
    ex_cannot_complete EXCEPTION;
BEGIN
    SELECT status
    INTO v_status
    FROM trips
    WHERE trip_id = p_id;

    IF v_status <> 'SCHEDULED' THEN
        RAISE ex_cannot_complete;
    END IF;

    UPDATE tickets
    SET status = 'CANCELLED'
    WHERE booking_id IN (
        SELECT booking_id FROM bookings
        WHERE trip_id = p_id AND status = 'PENDING'
    );

    UPDATE bookings
    SET status = 'CANCELLED'
    WHERE trip_id = p_id AND status = 'PENDING';

    UPDATE trips
    SET status = 'COMPLETED'
    WHERE trip_id = p_id;

    DBMS_OUTPUT.PUT_LINE('Trip completed: ' || p_id);
EXCEPTION
    WHEN ex_cannot_complete THEN
        DBMS_OUTPUT.PUT_LINE('Error: Only scheduled trips can be marked as completed.');
        RAISE;
END complete_trip;
/

CREATE OR REPLACE PROCEDURE delete_trip (p_id IN NUMBER)
AS
    v_booking_count NUMBER;
    ex_has_bookings EXCEPTION;
BEGIN
    SELECT COUNT(*)
    INTO v_booking_count
    FROM bookings
    WHERE trip_id = p_id;

    IF v_booking_count > 0 THEN
        RAISE ex_has_bookings;
    END IF;

    DELETE FROM trips WHERE trip_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;

    DBMS_OUTPUT.PUT_LINE('Trip deleted: ' || p_id);
EXCEPTION
    WHEN ex_has_bookings THEN
        DBMS_OUTPUT.PUT_LINE('Error: Cannot delete trip with existing booking records.');
        RAISE;
END delete_trip;
/

CREATE OR REPLACE PROCEDURE remove_reserved_ticket (p_ticket_id IN NUMBER)
AS
    v_status tickets.status%TYPE;
    ex_cannot_remove EXCEPTION;
BEGIN
    SELECT status
    INTO v_status
    FROM tickets
    WHERE ticket_id = p_ticket_id;

    IF v_status <> 'RESERVED' THEN
        RAISE ex_cannot_remove;
    END IF;

    DELETE FROM tickets WHERE ticket_id = p_ticket_id;
    DBMS_OUTPUT.PUT_LINE('Reserved ticket removed: ' || p_ticket_id);
EXCEPTION
    WHEN ex_cannot_remove THEN
        DBMS_OUTPUT.PUT_LINE('Error: Only unconfirmed RESERVED tickets can be removed.');
        RAISE;
END remove_reserved_ticket;
/
