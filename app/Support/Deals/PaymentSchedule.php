<?php

namespace App\Support\Deals;

use App\Models\PaymentInstallment;
use Illuminate\Support\Carbon;

class PaymentSchedule
{
    public const TEMPLATE_QUARTERLY = 'quarterly_3y';

    public const TEMPLATE_BALLOON = 'monthly_4y_balloon';

    public const TEMPLATE_CUSTOM = 'custom';

    /**
     * @return list<array{id: string, label: string, frequency: string, count: int, balloon_every: ?int}>
     */
    public static function templates(): array
    {
        return [
            [
                'id' => self::TEMPLATE_QUARTERLY,
                'label' => '3-year quarterly',
                'frequency' => 'quarterly',
                'count' => 12,
                'balloon_every' => null,
            ],
            [
                'id' => self::TEMPLATE_BALLOON,
                'label' => '4-year monthly with semi-annual balloons',
                'frequency' => 'monthly',
                'count' => 48,
                'balloon_every' => 6,
            ],
            [
                'id' => self::TEMPLATE_CUSTOM,
                'label' => 'Custom',
                'frequency' => 'monthly',
                'count' => 12,
                'balloon_every' => null,
            ],
        ];
    }

    /**
     * @return array{0: string, 1: int, 2: ?int}
     */
    public static function resolve(string $template, ?string $frequency, ?int $count): array
    {
        $match = collect(self::templates())->firstWhere('id', $template);

        if ($match === null || $template === self::TEMPLATE_CUSTOM) {
            return [
                $frequency === 'quarterly' ? 'quarterly' : 'monthly',
                max(1, (int) $count),
                null,
            ];
        }

        return [$match['frequency'], $match['count'], $match['balloon_every']];
    }

    /**
     * @return list<array{sequence: int, kind: string, label: string, amount: string, paid_amount: string, due_on: string, status: string, paid_at: ?string}>
     */
    public static function rows(
        int $downCents,
        int $handoverCents,
        int $remainderCents,
        int $count,
        string $frequency,
        ?int $balloonEvery,
        Carbon $firstDue,
    ): array {
        $rows = [];
        $sequence = 1;

        if ($downCents > 0) {
            $rows[] = self::row(
                $sequence,
                PaymentInstallment::KIND_DOWN_PAYMENT,
                'Down payment',
                $downCents,
                $downCents,
                now()->toDateString(),
                PaymentInstallment::STATUS_PAID,
                now()->toDateTimeString(),
            );
            $sequence++;
        }

        $weights = [];

        for ($index = 1; $index <= $count; $index++) {
            $weights[] = $balloonEvery !== null && $index % $balloonEvery === 0 ? 2 : 1;
        }

        $weightTotal = array_sum($weights) ?: 1;
        $base = intdiv($remainderCents, $weightTotal);
        $extra = $remainderCents % $weightTotal;
        $installmentNumber = 0;

        foreach ($weights as $offset => $weight) {
            $cents = ($base * $weight) + ($offset === count($weights) - 1 ? $extra : 0);

            if ($cents <= 0) {
                continue;
            }

            $installmentNumber++;
            $isBalloon = $weight > 1;
            $rows[] = self::row(
                $sequence,
                $isBalloon ? PaymentInstallment::KIND_BALLOON : PaymentInstallment::KIND_INSTALLMENT,
                $isBalloon ? 'Balloon '.$installmentNumber : 'Installment '.$installmentNumber,
                $cents,
                0,
                self::dueOn($firstDue, $offset, $frequency),
                PaymentInstallment::STATUS_PENDING,
                null,
            );
            $sequence++;
        }

        if ($handoverCents > 0) {
            $lastOffset = max(0, $count - 1);
            $rows[] = self::row(
                $sequence,
                PaymentInstallment::KIND_HANDOVER,
                'Handover',
                $handoverCents,
                0,
                self::dueOn($firstDue, $lastOffset, $frequency),
                PaymentInstallment::STATUS_PENDING,
                null,
            );
        }

        return $rows;
    }

    /**
     * @return array{sequence: int, kind: string, label: string, amount: string, paid_amount: string, due_on: string, status: string, paid_at: ?string}
     */
    protected static function row(
        int $sequence,
        string $kind,
        string $label,
        int $cents,
        int $paidCents,
        string $dueOn,
        string $status,
        ?string $paidAt,
    ): array {
        return [
            'sequence' => $sequence,
            'kind' => $kind,
            'label' => $label,
            'amount' => self::money($cents),
            'paid_amount' => self::money($paidCents),
            'due_on' => $dueOn,
            'status' => $status,
            'paid_at' => $paidAt,
        ];
    }

    protected static function dueOn(Carbon $firstDue, int $offset, string $frequency): string
    {
        $months = $frequency === 'quarterly' ? 3 : 1;

        return $firstDue->copy()->addMonths($offset * $months)->toDateString();
    }

    protected static function money(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }
}
