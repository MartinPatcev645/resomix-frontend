import React from "react";

interface WelcomeMessageProps {
    mobile?: boolean;
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({ mobile = true }) => (
    <div className="w-screen h-screen">
        <div className="w-[var(--px-355)] h-[var(--px-70)] bg-[var(--color-primary-background)]">
            Welcome
        </div>
    </div>
);
