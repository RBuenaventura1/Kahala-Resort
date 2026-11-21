export interface Room {
    id: string;
    name: string;
    description: string;
    room_type: string;
    max_guests: number;
    price_per_night: number;
    image_url: string | null;
    amenities: string[];
}

export interface Reservation {
    id: string;
    room_id: string;
    check_in: string;
    check_out: string;
    guests: number;
    total_price: number;
    status:
    | 'pending'
    | 'confirmed'
    | 'checked_in'
    | 'checked_out'
    | 'cancelled';
    special_requests: string | null;
    created_at: string;
    room: Room | null;
}

export function money(value: number): string {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
    }).format(Number(value));
}

export function stayDate(value: string): string {
    return new Intl.DateTimeFormat('en-PH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(new Date(`${value}T00:00:00Z`));
}

export function nightsBetween(start: string, end: string): number {
    const difference = Date.parse(end) - Date.parse(start);

    return Number.isFinite(difference)
        ? Math.max(0, Math.round(difference / 86400000))
        : 0;
}

export function localDate(date: Date): string {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}