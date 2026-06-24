
import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        if (import.meta.env.DEV) {
            console.error('Uncaught error:', error, errorInfo);
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 20 }} role="alert">
                    <h1>Something went wrong.</h1>
                    <p>Refresh the page to start over.</p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
