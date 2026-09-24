import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQuery } from './base.query'

/**
 * @param {Record<string, unknown>} payload
 * @returns {FormData}
 */
export function toVerifyTokenFormData(payload) {
    const body = new FormData()

    Object.entries(payload || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) {
            return
        }

        if (value instanceof File) {
            body.append(key, value)
            return
        }

        if (typeof value === 'boolean') {
            body.append(key, value ? '1' : '0')
            return
        }

        body.append(key, String(value))
    })

    return body
}

export const bookingApi = createApi({
    reducerPath: 'bookings',
    baseQuery: baseQuery('/bookings'),
    endpoints: (builder) => ({
        panel: builder.query({
            query: (code) => `${code}/panel`,
        }),
        verifyToken: builder.mutation({
            query: ({ code, ...payload }) => ({
                url: `${code}/enter-booking-kyc`,
                method: 'POST',
                body: toVerifyTokenFormData(payload),
            }),
        }),
        completeKyc: builder.mutation({
            query: ({ code, ...payload }) => ({
                url: `${code}/booking`,
                method: 'POST',
                body: payload,
            }),
        }),
        emailConfirmationLetter: builder.mutation({
            query: (code) => ({
                url: `${code}/booking-form/email`,
                method: 'POST',
            }),
        }),
    }),
})
