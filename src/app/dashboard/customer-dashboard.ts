import {
    Component,
    computed,
    effect,
    inject,
    signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import {
    money,
    nightsBetween,
    Reservation
} from '../booking/booking.models';

type StayFilter = 'all' | 'pending' | 'confirmed';

@Component({
    selector: 'app-customer-dashboard',
    imports: [RouterLink],
    templateUrl: './customer-dashboard.html',
    styleUrls: [
        './dashboard-layout.css',
        './kahala-theme.css'
    ],
})
export class CustomerDashboard {
    private readonly supabase = inject(SupabaseService);
    private readonly reload = signal(0);

    readonly stays = signal<Reservation[]>([]);
    readonly completed = signal<Reservation[]>([]);

    readonly filter = signal<StayFilter>('all');
    readonly page = signal(1);
    readonly total = signal(0);

    readonly loading = signal(false);
    readonly historyLoading = signal(false);
    readonly error = signal('');
    readonly historyError = signal('');

    readonly pageSize = 6;

    readonly pages = computed(() =>
        Math.max(1, Math.ceil(this.total() / this.pageSize))
    );

    readonly tabs: { value: StayFilter; label: string }[] = [
        { value: 'all', label: 'All stays' },
        { value: 'pending', label: 'Pending requests' },
        { value: 'confirmed', label: 'Confirmed' }
    ];

    readonly money = money;
    readonly nights = nightsBetween;

    readonly label = (value: string): string =>
        value.replace(/_/g, ' ');

    readonly date = (value: string): string =>
        new Intl.DateTimeFormat('en-PH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC'
        }).format(new Date(`${value}T00:00:00Z`));

    constructor() {
        effect((onCleanup) => {
            const userId = this.supabase.user()?.id;
            const page = this.page();
            const filter = this.filter();
            this.reload();

            let active = true;
            onCleanup(() => { active = false; });

            this.stays.set([]);
            this.total.set(0);
            this.error.set('');
            this.loading.set(!!userId);

            if (!userId) return;

            const load = async (): Promise<void> => {
                try {
                    const { data, count, error } =
                        await this.supabase.getMyReservations(
                            userId,
                            page,
                            this.pageSize,
                            filter
                        );

                    if (!active) return;
                    if (error) throw error;

                    const total = count ?? 0;
                    const lastPage = Math.max(
                        1,
                        Math.ceil(total / this.pageSize)
                    );

                    if (page > lastPage) {
                        this.page.set(lastPage);
                        return;
                    }

                    this.stays.set(data ?? []);
                    this.total.set(total);
                } catch (error: unknown) {
                    if (!active) return;

                    console.error('Stay loading failed:', error);
                    this.error.set('Unable to load your stays. Please refresh.');
                } finally {
                    if (active) this.loading.set(false);
                }
            };

            void load();
        });

        effect((onCleanup) => {
            const userId = this.supabase.user()?.id;
            this.reload();

            let active = true;
            onCleanup(() => { active = false; });

            this.completed.set([]);
            this.historyError.set('');
            this.historyLoading.set(!!userId);

            if (!userId) return;

            const load = async (): Promise<void> => {
                try {
                    const { data, error } =
                        await this.supabase.getMyReservations(
                            userId,
                            1,
                            4,
                            'checked_out'
                        );

                    if (!active) return;
                    if (error) throw error;

                    this.completed.set(data ?? []);
                } catch (error: unknown) {
                    if (!active) return;

                    console.error('Completed stay loading failed:', error);
                    this.historyError.set('Unable to load completed stays.');
                } finally {
                    if (active) this.historyLoading.set(false);
                }
            };

            void load();
        });
    }

    selectFilter(value: StayFilter): void {
        this.page.set(1);
        this.filter.set(value);
    }

    goToPage(value: number): void {
        if (
            this.loading() ||
            value < 1 ||
            value > this.pages()
        ) {
            return;
        }

        this.page.set(value);
    }

    refresh(): void {
        this.reload.update(value => value + 1);
    }
}