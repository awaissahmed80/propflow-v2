import { router } from '@inertiajs/react'
import { fetchBaseQuery } from '@reduxjs/toolkit/query'



export const baseAuthQuery = (baseUrl) => {   
    
    // const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    const getCookie = (name) => {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));

        return match ? decodeURIComponent(match[2]) : null;
    };

  

    return fetchBaseQuery({    
        // baseUrl: import.meta.env.VITE_API_URI + baseUrl,
        baseUrl:  baseUrl,
        credentials: 'same-origin',
        prepareHeaders: (headers) => {
            // const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
            const xsrfToken = getCookie('XSRF-TOKEN');
            
            headers.set('Accept', 'application/json') 
            // headers.set('Content-Type', 'application/json')                    
            headers.set('X-Requested-With', 'XMLHttpRequest');
            // headers.set('X-CSRF-TOKEN', csrfToken)     

            if (xsrfToken) {
                headers.set('X-XSRF-TOKEN', xsrfToken); // 🔥 This is what Laravel Sanctum uses
            }                   
            
            return headers
        }        
    })  
}

export const baseQuery = (baseUrl) => async (args, api, extraOptions) => {
    
    let result = await baseAuthQuery(baseUrl)(args, api, extraOptions)    
        
    if (result.error  && result.error.status === 401) {
        router.post('/logout');
    }
    
    else if (result.error && result.error.status === 'FETCH_ERROR') {
        result.error = {
            message: 'An error occured while fetching data from server',
            status: result.error.status
        };
    }

    else if( result.error){
        result.error = {
            ...result.error.data,
            status: result.error.status
        };
    }
    
    return result
}