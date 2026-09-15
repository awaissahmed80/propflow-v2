import { useEffect, useState } from 'react';

export const useOS = () => {
    const [ os, setOS ] = useState( 'other' );

    useEffect( () => {
        const userAgent = window.navigator.userAgent.toLowerCase();

        if ( userAgent.includes( 'mac' ) ) {
            setOS( 'mac' );
        } else if ( userAgent.includes( 'win' ) ) {
            setOS( 'windows' );
        } else if ( userAgent.includes( 'linux' ) ) {
            setOS( 'linux' );
        } else {
            setOS( 'other' );
        }
    }, [] );

    return os;
}