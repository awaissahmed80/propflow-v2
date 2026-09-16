import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQuery } from './base.query'


export const roleApi = createApi({
    reducerPath: 'roles',
    baseQuery: baseQuery('/user-roles'),    
    endpoints: (builder) => ({                           
        upsert: builder.mutation({
            query: (data) => ({
                url: '',
                method: data?.id ? 'PUT' : 'POST',                
                body: data,          
            }),                       
        }),
        delete: builder.mutation({
            query: (id) => ({
                url: `${id}`,
                method: 'DELETE',                
            }),             
        })          
    })
});