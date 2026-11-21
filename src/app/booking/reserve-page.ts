import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { SupabaseService } from '../services/supabase.service';
import {
    localDate,
    money,
    nightsBetween,
    Room
} from './booking.models';

@Component({
    selector: 'app-reserve-page',
    imports: [RouterLink, ReactiveFormsModule],
    styleUrl: './booking.css',
    template: `
    <nav class="page-nav" aria-label="Main navigation">
        <a class="brand" routerLink="/" aria-label="Kahala Resort home">
        <span class="brand-mark" aria-hidden="true">K</span>
        <span class="brand-text">
            KAHALA
            <small>RESORT &amp; RETREAT</small>
        </span>
        </a>
        <a routerLink="/my-reservations">My reservations</a>
    </nav>

    <main>
      <a routerLink="/" fragment="accommodations">← All accommodations</a>

      @if (loading()) {
        <p role="status">Loading room details…</p>
      }

      @if (loadError()) {
        <p class="error" role="alert">{{ loadError() }}</p>
      }

      @if (room(); as selected) {
        <h1>{{ selected.name }}</h1>

        <div class="layout">
          <article class="panel">
            @if (selected.image_url) {
              <img
                class="photo"
                [src]="selected.image_url"
                [alt]="selected.name"
              />
            }

            <h2>About your stay</h2>
            <p>{{ selected.description }}</p>
            <p>{{ selected.room_type }} · Up to {{ selected.max_guests }} guests</p>
            <p><strong>{{ money(selected.price_per_night) }}</strong> per night</p>

            <h2>Amenities</h2>
            <ul>
              @for (amenity of selected.amenities; track $index) {
                <li>{{ amenity }}</li>
              } @empty {
                <li>Please contact the resort for amenity details.</li>
              }
            </ul>
          </article>

          <section class="panel" aria-labelledby="bookingTitle">
            <h2 id="bookingTitle">Plan your stay</h2>

            @if (!supabase.authReady()) {
              <p role="status">Checking your session…</p>
            } @else if (!supabase.user()) {
              <p>Sign in or create an account to request this room.</p>
              <a
                class="action"
                routerLink="/"
                [queryParams]="{
                  login: '1',
                  returnTo: '/reserve/' + selected.id
                }"
              >
                Sign in to reserve
              </a>
            } @else {
              <form [formGroup]="form" (ngSubmit)="submit()">
                <fieldset [disabled]="busy()">
                  <legend>Your booking details</legend>

                  <label for="checkIn">Check-in</label>
                  <input
                    id="checkIn"
                    type="date"
                    formControlName="checkIn"
                    [min]="today"
                    required
                  />

                  <label for="checkOut">Check-out</label>
                  <input
                    id="checkOut"
                    type="date"
                    formControlName="checkOut"
                    [min]="values().checkIn || today"
                    required
                  />

                  <label for="guests">Guests</label>
                  <input
                    id="guests"
                    type="number"
                    formControlName="guests"
                    min="1"
                    [max]="selected.max_guests"
                    step="1"
                    required
                  />
                  <p class="muted">Maximum: {{ selected.max_guests }} guests.</p>

                  <label for="requests">Special requests (optional)</label>
                  <textarea
                    id="requests"
                    formControlName="specialRequests"
                    maxlength="1000"
                    rows="4"
                  ></textarea>

                  @if (nights() > 0) {
                    <p>
                      {{ money(selected.price_per_night) }}
                      × {{ nights() }} nights
                    </p>
                    <p><strong>Estimated total: {{ money(total()) }}</strong></p>
                  }

                  <p class="muted">
                    The final price is calculated when you submit.
                    This request is subject to availability and confirmation.
                  </p>

                  <button
                    class="submit"
                    type="submit"
                    [disabled]="busy() || form.invalid || nights() < 1"
                  >
                    {{ busy() ? 'Submitting…' : 'Request reservation' }}
                  </button>
                </fieldset>
              </form>
            }

            @if (error()) {
              <p class="error" role="alert">{{ error() }}</p>
            }

            @if (submittedId()) {
              <p role="status">Your request was submitted.</p>
              <a [routerLink]="['/my-reservations', submittedId()]">
                View your reservation
              </a>
            }
          </section>
        </div>
      }
    </main>
  `
})
export class ReservePage {
    readonly supabase = inject(SupabaseService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly fb = inject(FormBuilder);

    private readonly params = toSignal(this.route.paramMap, {
        initialValue: this.route.snapshot.paramMap
    });

    readonly room = signal<Room | null>(null);
    readonly loading = signal(true);
    readonly loadError = signal('');
    readonly error = signal('');
    readonly busy = signal(false);
    readonly submittedId = signal('');

    readonly today = localDate(new Date());

    readonly form = this.fb.nonNullable.group({
        checkIn: [this.today, Validators.required],
        checkOut: [
            localDate(new Date(Date.now() + 86400000)),
            Validators.required
        ],
        guests: [1, [Validators.required, Validators.min(1)]],
        specialRequests: ['', Validators.maxLength(1000)]
    });

    readonly values = toSignal(this.form.valueChanges, {
        initialValue: this.form.getRawValue()
    });

    readonly nights = computed(() =>
        nightsBetween(
            this.values().checkIn ?? '',
            this.values().checkOut ?? ''
        )
    );

    readonly total = computed(() =>
        this.nights() * Number(this.room()?.price_per_night ?? 0)
    );

    readonly money = money;

    constructor() {
        effect((onCleanup) => {
            const roomId = this.params().get('roomId') ?? '';
            let active = true;
            onCleanup(() => { active = false; });

            this.loading.set(true);
            this.room.set(null);
            this.loadError.set('');

            void this.supabase.getRoom(roomId)
                .then(({ data, error }) => {
                    if (!active) return;
                    if (error) throw error;

                    this.room.set(data);
                    if (!data) {
                        this.loadError.set('This room is unavailable or could not be found.');
                    }
                })
                .catch(() => {
                    if (active) {
                        this.loadError.set('Unable to load this room. Please try again.');
                    }
                })
                .finally(() => {
                    if (active) this.loading.set(false);
                });
        });
    }

    async submit(): Promise<void> {
        if (this.busy() || this.submittedId()) return;

        const room = this.room();
        const details = this.form.getRawValue();
        this.error.set('');

        if (
            !room ||
            this.form.invalid ||
            details.checkIn < localDate(new Date()) ||
            nightsBetween(details.checkIn, details.checkOut) < 1 ||
            !Number.isInteger(details.guests) ||
            details.guests > room.max_guests
        ) {
            this.error.set('Check your dates and guest count before submitting.');
            return;
        }

        this.busy.set(true);

        try {
            const user = await this.supabase.getCurrentUser();

            if (!user) {
                this.error.set('Your session has expired. Please sign in again.');
                return;
            }

            const { data, error } = await this.supabase.createReservation({
                roomId: room.id,
                checkIn: details.checkIn,
                checkOut: details.checkOut,
                guests: details.guests,
                specialRequests: details.specialRequests.trim()
            });

            if (error) throw error;

            // The RPC can expose its composite result as an object or array.
            const result: unknown = Array.isArray(data) ? data[0] : data;

            if (
                typeof result !== 'object' ||
                result === null ||
                !('id' in result) ||
                typeof result.id !== 'string'
            ) {
                this.error.set(
                    'The request completed. Check My reservations before submitting again.'
                );
                this.form.disable();
                return;
            }

            this.submittedId.set(result.id);
            this.form.disable();

            await this.router.navigate(['/my-reservations', result.id]);
        } catch (error: unknown) {
            console.error('Reservation submission failed:', error);
            this.error.set(
                'Unable to complete the request. Check My reservations before retrying.'
            );
        } finally {
            this.busy.set(false);
        }
    }
}