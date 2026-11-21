
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../services/supabase.service';

interface Room {
    id: string;
    name: string;
    description: string;
    room_type: string;
    max_guests: number;
    price_per_night: number;
    image_url: string | null;
    amenities: string[];
}

interface Experience {
    id: string;
    title: string;
    description: string;
    price: number;
    image_url: string | null;
    duration: string | null;
}

type ReservationRoomSummary = {
    name: string;
    room_type: string;
    image_url: string | null;
};

interface Reservation {
    id: string;
    room_id: string;
    check_in: string;
    check_out: string;
    guests: number;
    total_price: number;
    status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
    special_requests: string | null;
    rooms: ReservationRoomSummary | ReservationRoomSummary[] | null;
}

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './home.html',
    styleUrl: './home.css'
})

export class Home implements OnInit {
    private supabase = inject(SupabaseService);
    private cdr = inject(ChangeDetectorRef);

    private getReservationRoom(
        reservation: Reservation
    ): ReservationRoomSummary | null {
        return Array.isArray(reservation.rooms)
            ? reservation.rooms[0] ?? null
            : reservation.rooms;
    }

    reservationRoomName(reservation: Reservation): string {
        return this.getReservationRoom(reservation)?.name
            ?? 'Kahala accommodation';
    }

    reservationRoomType(reservation: Reservation): string {
        return this.getReservationRoom(reservation)?.room_type ?? 'Room';
    }

    rooms: Room[] = [];
    experiences: Experience[] = [];

    reservations: Reservation[] = [];
    loadingReservations = false;
    reservationError = '';

    loadingRooms = true;
    loadingExperiences = true;
    connectionMessage = '';

    mobileMenuOpen = false;
    selectedRoom: Room | null = null;

    checkIn = '';
    checkOut = '';
    guests = 2;
    specialRequests = '';

    signedIn = false;
    userEmail = '';
    busy = false;
    notice = '';
    noticeType: 'success' | 'error' = 'success';

    authMode: 'login' | 'register' = 'login';
    showAuth = false;
    authName = '';
    authEmail = '';
    authPassword = '';

    readonly reservationPageSize = 6;
    reservationPage = 1;
    reservationTotal = 0;

    private reservationUserId: string | null = null;
    private reservationRequestId = 0;

    get reservationTotalPages(): number {
        return Math.max(
            1,
            Math.ceil(this.reservationTotal / this.reservationPageSize)
        );
    }

    async ngOnInit(): Promise<void> {
        await Promise.all([
            this.loadRooms(),
            this.loadExperiences(),
            this.checkSession()
        ]);

        const today = new Date();
        this.checkIn = this.toDateInput(today);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.checkOut = this.toDateInput(tomorrow);

        this.supabase.client.auth.onAuthStateChange((_event, session) => {
            const user = session?.user;

            this.signedIn = !!user;
            this.userEmail = user?.email ?? '';

            if (user) {
                const userId = user.id;
                window.setTimeout(() => void this.loadMyReservations(userId), 0);
            } else {
                this.reservations = [];
                this.loadingReservations = false;
                this.clearReservations();
            }
        });
    }

    private toDateInput(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async loadRooms(): Promise<void> {
        this.loadingRooms = true;
        const { data, error } = await this.supabase.getRooms();

        if (error) {
            console.error('Room loading error:', error.message);
            this.connectionMessage = 'Unable to load rooms. Check your Supabase configuration and database policies.';
            this.rooms = [];
        } else {
            this.rooms = (data ?? []) as Room[];
            this.connectionMessage = '';
        }

        this.loadingRooms = false;
    }

    async loadExperiences(): Promise<void> {
        this.loadingExperiences = true;
        const { data, error } = await this.supabase.getExperiences();

        if (error) {
            console.error('Experience loading error:', error.message);
            this.experiences = [];
        } else {
            this.experiences = (data ?? []) as Experience[];
        }

        this.loadingExperiences = false;
    }

    async checkSession(): Promise<void> {
        const user = await this.supabase.getCurrentUser();
        this.signedIn = !!user;
        this.userEmail = user?.email ?? '';

        if (user) {
            await this.loadMyReservations(user.id);
        } else {
            this.reservations = [];
        }
    }

    scrollTo(id: string): void {
        document.getElementById(id)?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
        this.mobileMenuOpen = false;
    }

    chooseRoom(room: Room): void {
        this.selectedRoom = room;
        this.scrollTo('reservation');
    }

    get nights(): number {
        if (!this.checkIn || !this.checkOut) return 0;

        const start = new Date(`${this.checkIn}T00:00:00`);
        const end = new Date(`${this.checkOut}T00:00:00`);
        const difference = end.getTime() - start.getTime();

        return difference > 0
            ? Math.round(difference / 86400000)
            : 0;
    }

    get estimatedTotal(): number {
        return this.selectedRoom
            ? Number(this.selectedRoom.price_per_night) * this.nights
            : 0;
    }

    formatPrice(value: number): string {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            maximumFractionDigits: 0
        }).format(Number(value));
    }

    async submitReservation(): Promise<void> {
        this.notice = '';

        if (!this.selectedRoom) {
            this.showNotice('Please select a room first.', 'error');
            return;
        }

        if (!this.checkIn || !this.checkOut || this.nights < 1) {
            this.showNotice(
                'Please choose valid check-in and check-out dates.',
                'error'
            );
            return;
        }

        if (
            new Date(`${this.checkIn}T00:00:00`) <
            new Date(`${this.toDateInput(new Date())}T00:00:00`)
        ) {
            this.showNotice('Check-in cannot be in the past.', 'error');
            return;
        }

        if (
            this.guests < 1 ||
            this.guests > this.selectedRoom.max_guests
        ) {
            this.showNotice(
                `This room allows up to ${this.selectedRoom.max_guests} guests.`,
                'error'
            );
            return;
        }

        if (this.specialRequests.length > 1000) {
            this.showNotice(
                'Special requests must be 1,000 characters or fewer.',
                'error'
            );
            return;
        }

        const user = await this.supabase.getCurrentUser();

        if (!user) {
            this.showAuth = true;
            this.authMode = 'login';
            this.showNotice(
                'Please log in before making a reservation.',
                'error'
            );
            return;
        }

        this.busy = true;

        try {
            const { error } = await this.supabase.createReservation({
                roomId: this.selectedRoom.id,
                checkIn: this.checkIn,
                checkOut: this.checkOut,
                guests: this.guests,
                specialRequests: this.specialRequests.trim()
            });

            if (error) {
                console.error('Reservation request failed:', error);
                this.showNotice(
                    'We could not submit your reservation. Please check your details and try again.',
                    'error'
                );
                return;
            }

            this.showNotice(
                'Reservation submitted successfully. It is subject to availability and confirmation.',
                'success'
            );
            this.specialRequests = '';
            this.selectedRoom = null;
            await Promise.all([
                this.loadRooms(),
                this.loadMyReservations(user.id)
            ]);
        } catch (error: unknown) {
            console.error('Reservation request failed:', error);
            this.showNotice(
                'We could not submit your reservation. Please try again later.',
                'error'
            );
        } finally {
            this.busy = false;
        }
    }

    openAuth(mode: 'login' | 'register'): void {
        this.authMode = mode;
        this.showAuth = true;
        this.notice = '';
    }


    async submitAuth(): Promise<void> {
        if (this.busy) return;

        this.notice = '';

        const email = this.authEmail.trim();
        const password = this.authPassword;
        const fullName = this.authName.trim();
        const isRegistering = this.authMode === 'register';

        if (!email || !password) {
            this.showNotice('Enter your email and password.', 'error');
            return;
        }

        if (isRegistering && !fullName) {
            this.showNotice('Enter your full name.', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotice(
                'Your password must be at least 6 characters long.',
                'error'
            );
            return;
        }

        this.busy = true;

        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        try {
            const authRequest = isRegistering
                ? this.supabase.signUp(email, password, fullName)
                : this.supabase.signIn(email, password);

            const timeout = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error(
                        'The authentication request took too long. Check your connection and try again.'
                    ));
                }, 20000);
            });

            const result = await Promise.race([authRequest, timeout]);

            if (result.error) {
                console.error('Authentication error:', result.error);

                if (
                    result.error.status === 429 ||
                    /rate limit|too many requests/i.test(result.error.message)
                ) {
                    this.showNotice(
                        'Too many requests. Please wait before trying again.',
                        'error'
                    );
                } else {
                    this.showNotice(result.error.message, 'error');
                }

                return;
            }

            if (isRegistering && !result.data.session) {
                this.showAuth = false;
                this.authPassword = '';

                this.showNotice(
                    'Account created. Please check your email if confirmation is required.',
                    'success'
                );
                return;
            }

            this.signedIn = !!result.data.user;
            this.userEmail = result.data.user?.email ?? email;

            // Close the modal immediately after successful authentication.
            this.showAuth = false;
            this.authPassword = '';
            this.busy = false;

            this.showNotice(
                isRegistering
                    ? 'Welcome to Kahala! Your account has been created.'
                    : 'Welcome back!',
                'success'
            );
        } catch (error: unknown) {
            console.error('Authentication request failed:', error);

            this.showNotice(
                error instanceof Error
                    ? error.message
                    : 'Authentication failed. Please try again later.',
                'error'
            );
        } finally {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }

            this.busy = false;
            this.cdr.detectChanges();
        }
    }


    async signOut(): Promise<void> {
        const { error } = await this.supabase.signOut();

        if (error) {
            this.showNotice(error.message, 'error');
            return;
        }

        this.signedIn = false;
        this.userEmail = '';
        this.showNotice('You have signed out.', 'success');
    }

    showNotice(message: string, type: 'success' | 'error'): void {
        this.notice = message;
        this.noticeType = type;
    }

    get toDateInputForTemplate(): string {
        return this.toDateInput(new Date());
    }

    async loadMyReservations(
        userId: string,
        page = 1
    ): Promise<void> {
        const requestId = ++this.reservationRequestId;

        this.reservationUserId = userId;
        this.reservationPage = page;
        this.loadingReservations = true;
        this.reservationError = '';
        this.reservations = [];

        try {
            const { data, error, count } =
                await this.supabase.getMyReservations(
                    userId,
                    page,
                    this.reservationPageSize
                );

            // Ignore responses from an older request.
            if (requestId !== this.reservationRequestId) return;

            if (error) throw error;

            this.reservationTotal = count ?? 0;

            // Handle a page becoming empty after records are removed.
            if (page > this.reservationTotalPages) {
                await this.loadMyReservations(
                    userId,
                    this.reservationTotalPages
                );
                return;
            }

            this.reservations = (data ?? []) as Reservation[];
        } catch (error: unknown) {
            if (requestId !== this.reservationRequestId) return;

            console.error('Reservation loading failed:', error);
            this.reservationError =
                'Unable to load your reservations. Please try again.';
        } finally {
            if (requestId === this.reservationRequestId) {
                this.loadingReservations = false;
                this.cdr.detectChanges();
            }
        }
    }

    formatStayDate(dateValue: string): string {
        const [year, month, day] = dateValue.split('-').map(Number);

        return new Intl.DateTimeFormat('en-PH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC'
        }).format(new Date(Date.UTC(year, month - 1, day)));
    }

    formatReservationStatus(status: Reservation['status']): string {
        return status.replace(/_/g, ' ');
    }

    async changeReservationPage(page: number): Promise<void> {
        if (
            this.loadingReservations ||
            !this.reservationUserId ||
            page < 1 ||
            page > this.reservationTotalPages
        ) {
            return;
        }

        await this.loadMyReservations(this.reservationUserId, page);
    }

    private clearReservations(): void {
        // Invalidate requests that might finish after sign-out.
        ++this.reservationRequestId;

        this.reservationUserId = null;
        this.reservations = [];
        this.reservationTotal = 0;
        this.reservationPage = 1;
        this.reservationError = '';
        this.loadingReservations = false;
    }
}
