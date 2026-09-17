import { configureStore, combineReducers } from '@reduxjs/toolkit'
// import { projectApi, unitApi, roleApi, authApi,
//     userApi, teamApi, mediaApi, contactApi,
//     leadApi, campaignApi, dashboardApi, settingApi
// } from './api'
import { authApi, leadApi, roleApi } from './api';

const rootReducer = combineReducers({
    // [projectApi.reducerPath]: projectApi.reducer,     
    // [unitApi.reducerPath]: unitApi.reducer,
    [roleApi.reducerPath]: roleApi.reducer,     
    // [userApi.reducerPath]: userApi.reducer,   
    // [teamApi.reducerPath]: teamApi.reducer,  
    // [mediaApi.reducerPath]: mediaApi.reducer,
    [leadApi.reducerPath]: leadApi.reducer,
    // [campaignApi.reducerPath]: campaignApi.reducer,
    // [contactApi.reducerPath]: contactApi.reducer,
    // [dashboardApi.reducerPath]: dashboardApi.reducer,
    [authApi.reducerPath]: authApi.reducer,
    // [settingApi.reducerPath]: settingApi.reducer
})


const AppStore = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>    
        getDefaultMiddleware().concat(
        // projectApi.middleware,   
        // unitApi.middleware,        
        roleApi.middleware,  
        // userApi.middleware, 
        // teamApi.middleware,
        // mediaApi.middleware,
        leadApi.middleware,
        // campaignApi.middleware,
        // contactApi.middleware,
        // dashboardApi.middleware,
        authApi.middleware,
        // settingApi.middleware
    ),
});

export { AppStore }

