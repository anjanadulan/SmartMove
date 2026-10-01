SET SERVEROUTPUT ON;

CREATE OR REPLACE PROCEDURE schedule_trip (
    p_trip_id IN NUMBER,
    p_route_id IN NUMBER,
    p_vehicle_id IN NUMBER,
    p_driver_id IN NUMBER,
    p_departure IN DATE,
    p_arrival IN DATE
)
AS
    v_trip_fare routes.base_fare%TYPE;
    v_vehicle_status vehicles.status%TYPE;
    v_conflict_count NUMBER;
    ex_invalid_trip EXCEPTION;
BEGIN
    IF p_departure IS NULL OR p_arrival IS NULL
       OR p_departure <= SYSDATE OR p_arrival <= p_departure THEN
        RAISE ex_invalid_trip;
    END IF;

    SELECT base_fare
    INTO v_trip_fare
    FROM routes
    WHERE route_id = p_route_id;

    SELECT status
    INTO v_vehicle_status
    FROM vehicles
    WHERE vehicle_id = p_vehicle_id;

    SELECT COUNT(*)
    INTO v_conflict_count
    FROM trips
    WHERE status = 'SCHEDULED'
      AND (vehicle_id = p_vehicle_id OR driver_id = p_driver_id)
      AND departure_at < p_arrival
      AND arrival_at > p_departure;

    IF v_vehicle_status <> 'ACTIVE' OR v_conflict_count > 0 THEN
        RAISE ex_invalid_trip;
    END IF;

    SELECT COUNT(*)
    INTO v_conflict_count
    FROM maintenance_records
    WHERE vehicle_id = p_vehicle_id
      AND status = 'SCHEDULED'
      AND TRUNC(scheduled_date) < p_arrival
      AND TRUNC(scheduled_date) + 1 > p_departure;

    IF v_conflict_count > 0 THEN
        RAISE ex_invalid_trip;
    END IF;

    INSERT INTO trips (trip_id, route_id, vehicle_id, driver_id, departure_at, arrival_at, fare)
    VALUES (p_trip_id, p_route_id, p_vehicle_id, p_driver_id, p_departure, p_arrival, v_trip_fare);

    DBMS_OUTPUT.PUT_LINE('Trip scheduled successfully: ' || p_trip_id);
EXCEPTION
    WHEN ex_invalid_trip THEN
        DBMS_OUTPUT.PUT_LINE('Error: Invalid trip timing or vehicle/driver is unavailable.');
        RAISE;
END schedule_trip;
/

CREATE OR REPLACE PROCEDURE create_booking (
    p_booking_id IN NUMBER,
    p_passenger_id IN NUMBER,
    p_trip_id IN NUMBER
)
AS
    v_trip_status trips.status%TYPE;
    v_departure trips.departure_at%TYPE;
    ex_invalid_booking EXCEPTION;
BEGIN
    SELECT status, departure_at
    INTO v_trip_status, v_departure
    FROM trips
    WHERE trip_id = p_trip_id;

    IF v_trip_status <> 'SCHEDULED' OR v_departure <= SYSDATE THEN
        RAISE ex_invalid_booking;
    END IF;

    INSERT INTO bookings (booking_id, passenger_id, trip_id)
    VALUES (p_booking_id, p_passenger_id, p_trip_id);

    DBMS_OUTPUT.PUT_LINE('Booking created successfully: ' || p_booking_id);
EXCEPTION
    WHEN ex_invalid_booking THEN
        DBMS_OUTPUT.PUT_LINE('Error: Selected trip is not available for booking.');
        RAISE;
END create_booking;
/

CREATE OR REPLACE PROCEDURE reserve_seat (
    p_ticket_id IN NUMBER,
    p_booking_id IN NUMBER,
    p_seat_number IN NUMBER
)
AS
    v_trip_id bookings.trip_id%TYPE;
    v_booking_status bookings.status%TYPE;
    v_trip_status trips.status%TYPE;
    v_departure trips.departure_at%TYPE;
    v_fare trips.fare%TYPE;
    v_seat_count vehicles.seat_count%TYPE;
    v_seat_taken NUMBER;
    ex_invalid_seat EXCEPTION;
BEGIN
    SELECT trip_id, status
    INTO v_trip_id, v_booking_status
    FROM bookings
    WHERE booking_id = p_booking_id;

    SELECT t.fare, t.status, t.departure_at, v.seat_count
    INTO v_fare, v_trip_status, v_departure, v_seat_count
    FROM trips t
    JOIN vehicles v ON t.vehicle_id = v.vehicle_id
    WHERE t.trip_id = v_trip_id;

    IF p_seat_number IS NULL OR p_seat_number < 1
       OR p_seat_number > v_seat_count OR p_seat_number <> TRUNC(p_seat_number)
       OR v_booking_status <> 'PENDING' OR v_trip_status <> 'SCHEDULED'
       OR v_departure <= SYSDATE THEN
        RAISE ex_invalid_seat;
    END IF;

    SELECT COUNT(*)
    INTO v_seat_taken
    FROM tickets t
    JOIN bookings b ON t.booking_id = b.booking_id
    WHERE b.trip_id = v_trip_id
      AND t.seat_number = p_seat_number
      AND t.status IN ('RESERVED', 'ISSUED');

    IF v_seat_taken > 0 THEN
        RAISE ex_invalid_seat;
    END IF;

    INSERT INTO tickets (ticket_id, booking_id, seat_number, fare_amount)
    VALUES (p_ticket_id, p_booking_id, p_seat_number, v_fare);

    DBMS_OUTPUT.PUT_LINE('Seat reserved: ' || p_seat_number);
EXCEPTION
    WHEN ex_invalid_seat THEN
        DBMS_OUTPUT.PUT_LINE('Error: Seat unavailable or invalid seat number.');
        RAISE;
END reserve_seat;
/

CREATE OR REPLACE FUNCTION available_seats (p_trip_id IN NUMBER)
RETURN NUMBER
IS
    v_total_seats NUMBER;
    v_booked_seats NUMBER;
BEGIN
    SELECT v.seat_count
    INTO v_total_seats
    FROM vehicles v
    JOIN trips t ON v.vehicle_id = t.vehicle_id
    WHERE t.trip_id = p_trip_id;

    SELECT COUNT(*)
    INTO v_booked_seats
    FROM tickets t
    JOIN bookings b ON t.booking_id = b.booking_id
    WHERE b.trip_id = p_trip_id
      AND t.status IN ('RESERVED', 'ISSUED');

    RETURN v_total_seats - v_booked_seats;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN 0;
END available_seats;
/

CREATE OR REPLACE PROCEDURE record_payment (
    p_payment_id IN NUMBER,
    p_booking_id IN NUMBER,
    p_amount IN NUMBER,
    p_method IN VARCHAR2
)
AS
    v_booking_status bookings.status%TYPE;
    v_trip_status trips.status%TYPE;
    v_departure trips.departure_at%TYPE;
    v_total_amount NUMBER;
    ex_invalid_payment EXCEPTION;
BEGIN
    SELECT b.status, t.status, t.departure_at
    INTO v_booking_status, v_trip_status, v_departure
    FROM bookings b
    JOIN trips t ON b.trip_id = t.trip_id
    WHERE b.booking_id = p_booking_id;

    SELECT SUM(fare_amount)
    INTO v_total_amount
    FROM tickets
    WHERE booking_id = p_booking_id
      AND status = 'RESERVED';

    IF v_booking_status <> 'PENDING' OR v_trip_status <> 'SCHEDULED'
       OR v_departure <= SYSDATE OR v_total_amount IS NULL
       OR p_amount IS NULL OR p_amount <> v_total_amount THEN
        RAISE ex_invalid_payment;
    END IF;

    INSERT INTO payments (payment_id, booking_id, payment_method, amount)
    VALUES (p_payment_id, p_booking_id, p_method, p_amount);

    UPDATE tickets
    SET status = 'ISSUED'
    WHERE booking_id = p_booking_id
      AND status = 'RESERVED';

    UPDATE bookings
    SET status = 'CONFIRMED'
    WHERE booking_id = p_booking_id;

    DBMS_OUTPUT.PUT_LINE('Payment processed successfully: LKR ' || p_amount);
EXCEPTION
    WHEN ex_invalid_payment THEN
        DBMS_OUTPUT.PUT_LINE('Error: Payment verification failed.');
        RAISE;
END record_payment;
/

CREATE OR REPLACE PROCEDURE cancel_booking (p_booking_id IN NUMBER)
AS
    v_booking_status bookings.status%TYPE;
    v_departure trips.departure_at%TYPE;
    ex_invalid_cancel EXCEPTION;
BEGIN
    SELECT b.status, t.departure_at
    INTO v_booking_status, v_departure
    FROM bookings b
    JOIN trips t ON b.trip_id = t.trip_id
    WHERE b.booking_id = p_booking_id;

    IF v_booking_status = 'CANCELLED' OR v_departure <= SYSDATE THEN
        RAISE ex_invalid_cancel;
    END IF;

    UPDATE tickets
    SET status = 'CANCELLED'
    WHERE booking_id = p_booking_id;

    UPDATE bookings
    SET status = 'CANCELLED'
    WHERE booking_id = p_booking_id;

    DBMS_OUTPUT.PUT_LINE('Booking cancelled: ' || p_booking_id);
EXCEPTION
    WHEN ex_invalid_cancel THEN
        DBMS_OUTPUT.PUT_LINE('Error: Cannot cancel booking after trip departure.');
        RAISE;
END cancel_booking;
/

CREATE OR REPLACE PROCEDURE process_refund (
    p_refund_id IN NUMBER,
    p_payment_id IN NUMBER,
    p_reason IN VARCHAR2
)
AS
    v_amount payments.amount%TYPE;
    v_booking_status bookings.status%TYPE;
    ex_invalid_refund EXCEPTION;
BEGIN
    SELECT p.amount, b.status
    INTO v_amount, v_booking_status
    FROM payments p
    JOIN bookings b ON p.booking_id = b.booking_id
    WHERE p.payment_id = p_payment_id;

    IF v_booking_status <> 'CANCELLED' THEN
        RAISE ex_invalid_refund;
    END IF;

    INSERT INTO refunds (refund_id, payment_id, amount, reason)
    VALUES (p_refund_id, p_payment_id, v_amount, p_reason);

    DBMS_OUTPUT.PUT_LINE('Refund processed: LKR ' || v_amount);
EXCEPTION
    WHEN ex_invalid_refund THEN
        DBMS_OUTPUT.PUT_LINE('Error: Booking must be cancelled before issuing refund.');
        RAISE;
END process_refund;
/

CREATE OR REPLACE PROCEDURE complete_maintenance (
    p_maintenance_id IN NUMBER,
    p_cost IN NUMBER
)
AS
    ex_invalid_maintenance EXCEPTION;
BEGIN
    IF p_cost IS NULL OR p_cost < 0 THEN
        RAISE ex_invalid_maintenance;
    END IF;

    UPDATE maintenance_records
    SET status = 'COMPLETED',
        completed_date = SYSDATE,
        cost = p_cost
    WHERE maintenance_id = p_maintenance_id
      AND status = 'SCHEDULED'
      AND TRUNC(scheduled_date) <= TRUNC(SYSDATE);

    IF SQL%ROWCOUNT = 0 THEN
        RAISE ex_invalid_maintenance;
    ELSE
        DBMS_OUTPUT.PUT_LINE('Maintenance record updated to completed.');
    END IF;
EXCEPTION
    WHEN ex_invalid_maintenance THEN
        DBMS_OUTPUT.PUT_LINE('Error: Invalid maintenance record or cost amount.');
        RAISE;
END complete_maintenance;
/
