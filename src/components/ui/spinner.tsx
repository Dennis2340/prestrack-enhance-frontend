import React from 'react';

const Spinner = () => {
    return (
        <div className="loader">
            <style jsx>{`
                .loader {
                    border: 4px solid rgba(255, 255, 255, 0.3);
                    border-radius: 50%;
                    border-top: 4px solid #ffffff;
                    width: 20px;
                    height: 20px;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default Spinner;