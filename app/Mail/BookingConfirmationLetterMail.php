<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Spatie\LaravelPdf\Facades\Pdf;

class BookingConfirmationLetterMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  array<string, mixed>  $pdfViewData
     */
    public function __construct(
        public Order $order,
        public string $buyerName,
        public string $businessName,
        public array $pdfViewData,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Booking confirmation letter — '.$this->buyerName,
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.booking-confirmation-letter',
            with: [
                'buyerName' => $this->buyerName,
                'businessName' => $this->businessName,
                'bookingNumber' => $this->order->booking_number ?: $this->order->code,
                'projectTitle' => $this->order->project?->title,
                'unitName' => $this->order->unit?->name,
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        $filename = 'booking-confirmation-letter-'.$this->order->code.'.pdf';

        return [
            Pdf::view('portal.booking-form', $this->pdfViewData)
                ->driver('dompdf')
                ->format('a4')
                ->margins(12, 12, 12, 12)
                ->name($filename)
                ->toMailAttachment(),
        ];
    }
}
