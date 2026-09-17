import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQuery } from './base.query'


export const leadApi = createApi({
    reducerPath: 'leads',
    baseQuery: baseQuery('/leads'),
    endpoints: (builder) => ({
        boardColumn: builder.query({
            query: ({ stageId, ...params }) => ({
                url: `board/${stageId}`,
                params,
            }),
        }),
        upsert: builder.mutation({
            query: (data) => ({
                url: data?.id ? `${data.id}` : '',
                method: data?.id ? 'PUT' : 'POST',
                body: data,
            }),
        }),
        update: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `${id}`,
                method: 'PATCH',
                body: data,
            }),
        }),
        bulk: builder.mutation({
            query: (data) => ({
                url: 'bulk',
                method: 'POST',
                body: data,
            }),
        }),
        archive: builder.mutation({
            query: (id) => ({
                url: `${id}/archive`,
                method: 'POST',
            }),
        }),
        restore: builder.mutation({
            query: (id) => ({
                url: `${id}/restore`,
                method: 'POST',
            }),
        }),
        delete: builder.mutation({
            query: (id) => ({
                url: `${id}`,
                method: 'DELETE',
            }),
        }),
    }),
});
