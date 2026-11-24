import React from 'react';

// Last-resort error state: if a page throws while rendering, show a short
// message and a way out instead of a blank screen.
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error) {
        // eslint-disable-next-line no-console
        console.error('Page crashed:', error);
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div className="page page--narrow">
                <div className="empty-state" role="alert">
                    <h1>Something went wrong</h1>
                    <p>This page could not be shown. Reloading usually fixes it.</p>
                    <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>Reload the page</button>
                </div>
            </div>
        );
    }
}
