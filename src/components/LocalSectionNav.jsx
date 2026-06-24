import React from 'react';

export default function LocalSectionNav({ label, items, className = '' }) {
    if (items.length < 2) return null;

    return (
        <nav className={`local-section-nav ${className}`} aria-label={label}>
            <span className="local-section-nav-label">On this tab</span>
            <div className="local-section-nav-links">
                {items.map(item => (
                    <a key={item.href} href={item.href}>{item.label}</a>
                ))}
            </div>
            <style>{`
                .local-section-nav {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                    min-width: 0;
                    padding: 8px 10px;
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-md);
                    background: rgba(255, 255, 255, 0.72);
                }
                .local-section-nav-label {
                    flex: 0 0 auto;
                    color: var(--text-muted);
                    font-size: .67rem;
                    font-weight: 800;
                    letter-spacing: .04em;
                    text-transform: uppercase;
                }
                .local-section-nav-links {
                    display: flex;
                    min-width: 0;
                    gap: 4px;
                    overflow-x: auto;
                    scrollbar-width: none;
                }
                .local-section-nav-links::-webkit-scrollbar { display: none; }
                .local-section-nav a {
                    flex: 0 0 auto;
                    padding: 5px 8px;
                    border-radius: var(--radius-pill);
                    color: var(--text-main);
                    font-size: .76rem;
                    font-weight: 800;
                    line-height: 1;
                    text-decoration: none;
                    white-space: nowrap;
                }
                .local-section-nav a:hover,
                .local-section-nav a:focus-visible {
                    background: #eff6ff;
                    color: #1d4ed8;
                    outline: none;
                }
                @media (max-width: 640px) {
                    .local-section-nav { gap: var(--space-2); }
                    .local-section-nav-label { display: none; }
                }
            `}</style>
        </nav>
    );
}
