import React, { useEffect } from "react";
import { Dialog } from "../Modals/Dialog";
import { useFeedbackStore } from "@resomix/stores";
import { useFeedbackSubmit } from "@resomix/hooks";
import { StatusMessage } from "../Elements/StatusMessage";

interface FeedbackFormProps {
    onClose?: () => void;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({ onClose }) => {
    const { hideFeedbackForm } = useFeedbackStore();
    const {
        satisfaction,
        setSatisfaction,
        recommendation,
        setRecommendation,
        setFeedback,
        handleSubmit,
        submitting,
    } = useFeedbackSubmit();

    const [showStatus, setShowStatus] = React.useState(false);
    const [statusType, setStatusType] = React.useState<'loading' | 'success' | 'error'>('loading');
    const [statusMessage, setStatusMessage] = React.useState('');

    const submitHandler = async () => {
        setStatusType('loading');
        setShowStatus(true);
        const result = await handleSubmit();
        if (result.success) {
            setStatusType('success');
            setStatusMessage('Feedback submitted successfully!');
        } else {
            setStatusType('error');
            setStatusMessage(result.message || 'An error occurred');
        }
    };

    // lock body scroll while modal open
    useEffect(() => {
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = original; };
    }, []);

    const handleClose = () => {
        hideFeedbackForm();
        onClose?.();
    };

    return (
        <Dialog
            isOpen
            onClose={handleClose}
            size="md"
            eyebrow="Resomix // Feedback"
            title="Your feedback"
            subtitle="Tell us how the results felt — it goes straight to the team."
            ariaLabel="Your feedback"
            actions={[
                // No Close action — the shell's ✕ is the universal exit.
                { label: 'Submit', onClick: submitHandler, tone: 'primary' },
            ]}
        >
                <div className="flex flex-col w-full gap-[var(--px-15)] pb-[var(--px-4)]">
                    <div className="flex flex-col items-start text-left w-full">
                        <div className="text-[length:var(--px-14)] font-medium font-fira mb-[var(--px-10)]">
                            How satisfied are you with the results?
                        </div>
                        {/* Display numbers from 1 to 10 with boxes */}
                        <div className="flex items-center justify-between w-full">
                            {Array.from({ length: 10 }, (_, index) => {
                                const val = index + 1;
                                return (
                                    <div
                                        key={val}
                                        onClick={() => setSatisfaction(val)}
                                        className={`text-[length:var(--px-12)] font-medium font-fira w-[var(--px-37)] h-[var(--px-26)] border border-dotted border-[var(--color-primary)] flex items-center justify-center hover:cursor-pointer hover:bg-[var(--color-primary-hover)] hover:text-[var(--color-secondary)] ${val === satisfaction ? 'bg-[var(--color-primary)] text-[var(--color-secondary)]' : 'bg-[var(--color-primary-background)]'}`}
                                    >
                                        {val}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-[length:var(--px-11)] text-[var(--color-primary-hover)] font-fira flex items-center justify-between w-full mt-[var(--px-5)]">
                            <span>Not Satisfied</span>
                            <span>Very Satisfied</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-start text-left w-full">
                        <div className="text-[length:var(--px-14)] font-medium font-fira mb-[var(--px-10)]">
                            How likely are you to recommend Resomix?
                        </div>
                        {/* Display numbers from 1 to 10 with boxes */}
                        <div className="flex items-center justify-between w-full">
                            {Array.from({ length: 10 }, (_, index) => {
                                const val = index + 1;
                                return (
                                    <div
                                        key={val}
                                        onClick={() => setRecommendation(val)}
                                        className={`text-[length:var(--px-12)] font-medium font-fira w-[var(--px-37)] h-[var(--px-26)] border border-dotted border-[var(--color-primary)] flex items-center justify-center hover:cursor-pointer hover:bg-[var(--color-primary-hover)] hover:text-[var(--color-secondary)] ${val === recommendation ? 'bg-[var(--color-primary)] text-[var(--color-secondary)]' : 'bg-[var(--color-primary-background)]'}`}
                                    >
                                        {val}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-[length:var(--px-11)] text-[var(--color-primary-hover)] font-fira flex items-center justify-between w-full mt-[var(--px-5)]">
                            <span>Not Likely</span>
                            <span>Very Likely</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-start text-left w-full">
                        <div className="text-[length:var(--px-12)] font-medium font-fira mb-[var(--px-10)]">
                            Additional feedback <span className="text-[var(--color-primary-hover)] font-light font-fira text-[length:var(--px-11)]">(optional)</span>
                        </div>
                        {/* Display Input area with same border and proper padding and text font */}
                        <textarea
                            name="feedback"
                            onChange={(e) => setFeedback(e.target.value)}
                            className="w-full p-[var(--px-10)] text-[length:var(--px-16)] lg:text-[length:var(--px-10)] font-medium font-fira border border-dotted border-[var(--color-primary)] rounded-xs"
                            rows={4}
                            placeholder="Tell us more about your experience with Resomix..."
                        />
                    </div>
                </div>

                <StatusMessage
                    isOpen={showStatus}
                    onClose={() => {
                        setShowStatus(false);
                        if (statusType === 'success') hideFeedbackForm();
                    }}
                    status={statusType}
                    message={statusMessage}
                />
        </Dialog>
    );
};
