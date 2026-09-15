import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQuery } from './base.query'


export const authApi = createApi({
    reducerPath: 'auth',
    baseQuery: baseQuery('/'),        
    endpoints: (builder) => ({               
        logout: builder.mutation({
            query: () => ({
                url: 'logout',
                method: 'POST',                                
            })
                                
        }),
    })
});