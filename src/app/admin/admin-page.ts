import {
    Component,
    DestroyRef,
    computed,
    effect,
    inject,
    signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { money, stayDate } from '../booking/booking.models';
import {
    AdminReservation,
    ReservationStatus
} from './admin.models';

@Component({
    selector: 'app-admin-page',
    imports: [RouterLink],
    templateUrl: './admin-page.html',
    styleUrls: [
        '../booking/booking.css',
        './admin-page.css',
        '../dashboard/dashboard-content.css',
        '../dashboard/kahala-theme.css'
    ]
})
export class AdminPage {
    readonly supabase = inject(SupabaseService);

    private readonly destroyRef = inject(DestroyRef);
    private readonly reload = signal(0);

    readonly rows = signal<AdminReservation[]>([]);
    readonly page = signal(1);
    readonly filter = signal('all');
    readonly total = signal(0);
    readonly loading = signal(false);
    readonly denied = signal(false);
    readonly saving = signal(false);
    readonly error = signal('');

    readonly pendingChange = signal<{
        booking: AdminReservation;
        next: ReservationStatus;
    } | null>(null);

    readonly statuses: ReservationStatus[] = [
        'pending',
        'confirmed',
        'checked_in',
        'checked_out',
        'cancelled'
    ];

    readonly pageSize = 10;

    readonly pages = computed(() =>
        Math.max(1, Math.ceil(this.total() / this.pageSize))
    );

    readonly money = money;
    readonly stayDate = stayDate;

    readonly label = (status: string): string =>
        status.replace(/_/g, ' ');

    constructor() {
        effect((onCleanup) => {
            const userId = this.supabase.user()?.id;
            const ready = this.supabase.authReady();
            const page = this.page();
            const filter = this.filter();
            this.reload();

            let active = true;
            onCleanup(() => { active = false; });

            this.rows.set([]);
            this.total.set(0);
            this.error.set('');
            this.denied.set(false);
            this.pendingChange.set(null);
            this.loading.set(ready && !!userId);

            if (!ready || !userId) return;

            const load = async (): Promise<void> => {
                try {
                    const { data, error } =
                        await this.supabase.getAdminReservations(
                            page,
                            this.pageSize,
                            filter
                        );

                    if (!active) return;

                    if (error) {
                        if (error.code === '42501') {
                            this.denied.set(true);
                            return;
                        }

                        throw error;
                    }

                    if (!data) {
                        throw new Error('Missing reservation response.');
                    }

                    const lastPage = Math.max(
                        1,
                        Math.ceil(data.total / this.pageSize)
                    );

                    if (page > lastPage) {
                        this.page.set(lastPage);
                        return;
                    }

                    this.rows.set(data.items);
                    this.total.set(data.total);
                } catch (error: unknown) {
                    if (!active) return;

                    console.error('Admin reservation loading failed:', error);
                    this.error.set(
                        'Unable to load reservations. Please try again.'
                    );
                } finally {
                    if (active) this.loading.set(false);
                }
            };

            void load();
        });
    }

    refresh(): void {
        this.reload.update(value => value + 1);
    }

    setFilter(value: string): void {
        if (
            this.saving() ||
            (value !== 'all' && !this.statuses.some(s => s === value))
        ) {
            return;
        }

        this.page.set(1);
        this.filter.set(value);
    }

    goToPage(value: number): void {
        if (
            this.loading() ||
            this.saving() ||
            value < 1 ||
            value > this.pages()
        ) {
            return;
        }

        this.page.set(value);
    }

    actions(status: ReservationStatus): ReservationStatus[] {
        switch (status) {
            case 'pending':
                return ['confirmed', 'cancelled'];
            case 'confirmed':
                return ['checked_in', 'cancelled'];
            case 'checked_in':
                return ['checked_out'];
            default:
                return [];
        }
    }

    requestChange(
        booking: AdminReservation,
        next: ReservationStatus
    ): void {
        this.error.set('');
        this.pendingChange.set({ booking, next });
    }

    async confirmChange(): Promise<void> {
        const change = this.pendingChange();
        const userId = this.supabase.user()?.id;

        if (!change || !userId || this.saving()) return;

        this.saving.set(true);
        this.error.set('');

        try {
            const { error } =
                await this.supabase.updateAdminReservationStatus(
                    change.booking.id,
                    change.booking.status,
                    change.next
                );

            if (
                this.destroyRef.destroyed ||
                this.supabase.user()?.id !== userId
            ) {
                return;
            }

            if (error) {
                if (error.code === '42501') {
                    this.rows.set([]);
                    this.denied.set(true);
                }

                throw error;
            }

            this.pendingChange.set(null);
            this.refresh();
        } catch (error: unknown) {
            if (
                this.destroyRef.destroyed ||
                this.supabase.user()?.id !== userId
            ) {
                return;
            }

            console.error('Admin status update failed:', error);
            this.error.set(
                'The status could not be updated. Refresh to check its current value.'
            );
        } finally {
            if (!this.destroyRef.destroyed) {
                this.saving.set(false);
            }
        }
    }
}