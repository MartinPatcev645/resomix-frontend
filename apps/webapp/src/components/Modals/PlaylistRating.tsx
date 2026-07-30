import React, { useEffect, useState } from 'react'
import { Dialog, PAGE_FIELD, PAGE_FIELD_LABEL } from '@resomix/ui'
import { GoodIcon, BadIcon, FineIcon, FireIcon } from '@/components/index.ts'
import { ratePlaylist } from '@resomix/api-client';
import { usePlaylistStore } from '@resomix/stores';

type RatingType = 'bad' | 'fine' | 'good' | 'fire'

interface PlaylistRatingProps {
    isOpen: boolean
    onClose: () => void
    onStatusChange: (status: 'loading' | 'success' | 'error', message: string) => void
}

export const PlaylistRating: React.FC<PlaylistRatingProps> = ({
    isOpen,
    onClose,
    onStatusChange,
}) => {
    const [selectedRating, setSelectedRating] = useState<RatingType | null>(null)
    const [hoveredRating, setHoveredRating] = useState<RatingType | null>(null)
    const [feedback, setFeedback] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const { playlistData } = usePlaylistStore()

    const ratingMap: Record<RatingType, number> = { bad: 0, fine: 1, good: 2, fire: 3 }

    const handleSubmit = async () => {
        if (!selectedRating || !playlistData?.playlist?.id) {
            onClose()
            return
        }
        setSubmitting(true)
        onStatusChange('loading', 'Submitting feedback...')
        try {
            const numericRating = ratingMap[selectedRating]
            const res = await ratePlaylist(playlistData.playlist.id, numericRating, feedback.trim() || null)
            if (res.success) {
                onStatusChange('success', 'Feedback submitted successfully!')
            } else {
                onStatusChange('error', res.error || 'Failed to submit feedback')
            }
        } catch (err) {
            console.error('Failed to rate playlist', err)
            onStatusChange('error', 'Unexpected error while submitting feedback')
        } finally {
            setSubmitting(false)
            onClose()
        }
    }

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }

        // Cleanup on unmount
        return () => {
            document.body.style.overflow = 'unset'
            setSelectedRating(null)
            setHoveredRating(null)
        }
    }, [isOpen])

    // Close modal on escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
        }

        return () => {
            document.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen, onClose])

    const handleRatingSelect = (rating: RatingType) => {
        setSelectedRating(rating)
    }

    const getIconColor = (rating: RatingType) => {
        if (selectedRating === rating) {
            return hoveredRating === rating ? 'var(--color-primary-hover)' : 'var(--color-primary)'
        }
        return hoveredRating === rating ? 'var(--color-primary-hover)' : undefined
    }

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            size="md"
            eyebrow="Playlist // Feedback"
            title="Rate these results"
            subtitle="How well did the similarity results match your reference?"
            ariaLabel="Rate these results"
            actions={[
                // No Cancel action — the shell's ✕ is the universal exit.
                {
                    label: 'Submit Feedback',
                    onClick: handleSubmit,
                    tone: 'primary',
                    busy: submitting,
                    busyLabel: 'Submitting...',
                    id: 'playlist-rating-submit-button',
                },
            ]}
        >
            <div className="flex flex-col gap-[var(--px-20)] pb-[var(--px-4)]">

                <fieldset className='flex items-center w-full justify-evenly mb-[var(--px-10)]'>
                    <legend className="sr-only">Rate the playlist</legend>
                    
                    <label
                        className='flex flex-col items-center gap-[var(--px-10)] group cursor-pointer rating-option'
                        id="playlist-rating-bad"
                        onMouseEnter={() => setHoveredRating('bad')}
                        onMouseLeave={() => setHoveredRating(null)}
                    >
                        <input
                            type="radio"
                            name="playlist-rating"
                            value="bad"
                            checked={selectedRating === 'bad'}
                            onChange={() => handleRatingSelect('bad')}
                            className="sr-only"
                        />
                        <BadIcon
                            className='w-[var(--px-45)] h-[var(--px-45)] transition-colors'
                            selected={selectedRating === 'bad'}
                            color={getIconColor('bad')}
                        />
                        <span className='text-[length:var(--px-9)] font-light leading-[var(--px-12)] font-fira text-[var(--color-primary)] group-hover:text-[var(--color-primary-hover)] transition-colors'>
                            Bad
                        </span>
                    </label>
                    <label
                        className='flex flex-col items-center gap-[var(--px-10)] group cursor-pointer rating-option'
                        id="playlist-rating-fine"
                        onMouseEnter={() => setHoveredRating('fine')}
                        onMouseLeave={() => setHoveredRating(null)}
                    >
                        <input
                            type="radio"
                            name="playlist-rating"
                            value="fine"
                            checked={selectedRating === 'fine'}
                            onChange={() => handleRatingSelect('fine')}
                            className="sr-only"
                        />
                        <FineIcon
                            className='w-[var(--px-45)] h-[var(--px-45)] transition-colors'
                            selected={selectedRating === 'fine'}
                            color={getIconColor('fine')}
                        />
                        <span className='text-[length:var(--px-9)] font-light leading-[var(--px-12)] font-fira text-[var(--color-primary)] group-hover:text-[var(--color-primary-hover)] transition-colors'>
                            Fine
                        </span>
                    </label>
                    <label
                        className='flex flex-col items-center gap-[var(--px-10)] group cursor-pointer rating-option'
                        id="playlist-rating-good"
                        onMouseEnter={() => setHoveredRating('good')}
                        onMouseLeave={() => setHoveredRating(null)}
                    >
                        <input
                            type="radio"
                            name="playlist-rating"
                            value="good"
                            checked={selectedRating === 'good'}
                            onChange={() => handleRatingSelect('good')}
                            className="sr-only"
                        />
                        <GoodIcon
                            className='w-[var(--px-45)] h-[var(--px-45)] transition-colors'
                            selected={selectedRating === 'good'}
                            color={getIconColor('good')}
                        />
                        <span className='text-[length:var(--px-9)] font-light leading-[var(--px-12)] font-fira text-[var(--color-primary)] group-hover:text-[var(--color-primary-hover)] transition-colors'>
                            Good
                        </span>
                    </label>
                    <label
                        className='flex flex-col items-center gap-[var(--px-10)] group cursor-pointer rating-option'
                        id="playlist-rating-fire"
                        onMouseEnter={() => setHoveredRating('fire')}
                        onMouseLeave={() => setHoveredRating(null)}
                    >
                        <input
                            type="radio"
                            name="playlist-rating"
                            value="fire"
                            checked={selectedRating === 'fire'}
                            onChange={() => handleRatingSelect('fire')}
                            className="sr-only"
                        />
                        <FireIcon
                            className='w-[var(--px-45)] h-[var(--px-45)] transition-colors'
                            selected={selectedRating === 'fire'}
                            color={getIconColor('fire')}
                        />
                        <span className='text-[length:var(--px-9)] font-light leading-[var(--px-12)] font-fira text-[var(--color-primary)] group-hover:text-[var(--color-primary-hover)] transition-colors'>
                            Fire
                        </span>
                    </label>
                </fieldset>

                <div className="flex flex-col items-start gap-[var(--px-10)] w-full">
                    <label htmlFor="rating-feedback" className={PAGE_FIELD_LABEL}>
                        Share your experience <span className="opacity-70">(optional)</span>
                    </label>
                    <textarea
                        id="rating-feedback"
                        className={`${PAGE_FIELD} py-[var(--px-8)] leading-[var(--px-18)]`}
                        rows={4}
                        placeholder="Please describe your rating or feedback in detail..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                    />
                </div>

            </div>
        </Dialog>
    )
}

export default PlaylistRating;
