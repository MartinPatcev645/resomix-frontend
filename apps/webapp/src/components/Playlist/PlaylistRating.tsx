import React, { useEffect, useState } from 'react'
import { ButtonSleek } from '@resomix/ui'
import { GoodIcon, BadIcon, FineIcon, FireIcon } from '@/components/index.ts'

type RatingType = 'bad' | 'fine' | 'good' | 'fire'

interface PlaylistRatingProps {
    isOpen: boolean
    onClose: () => void
    message?: string
}

export const PlaylistRating: React.FC<PlaylistRatingProps> = ({
    isOpen,
    onClose,
    message = "Rate the similarity results of this playlist"
}) => {
    const [selectedRating, setSelectedRating] = useState<RatingType | null>(null)
    const [hoveredRating, setHoveredRating] = useState<RatingType | null>(null)

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

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop with blur effect */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal content */}
            <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl p-[var(--px-50)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-20)]">
                <div className="text-center mb-[var(--px-24)] w-full">
                    <div className="text-[length:var(--px-19)] font-semibold uppercase font-helvetica leading-[var(--px-24)]">
                        {message}
                    </div>
                </div>

                <div className='flex items-center w-full justify-evenly mb-[var(--px-10)]'>
                    <div 
                        className='flex flex-col items-center gap-[var(--px-10)] group cursor-pointer'
                        onClick={() => handleRatingSelect('bad')}
                        onMouseEnter={() => setHoveredRating('bad')}
                        onMouseLeave={() => setHoveredRating(null)}
                    >
                        <BadIcon 
                            className='w-[var(--px-45)] h-[var(--px-45)] transition-colors' 
                            selected={selectedRating === 'bad'}
                            color={getIconColor('bad')}
                        />
                        <div className='text-[length:var(--px-9)] font-light leading-[var(--px-12)] font-fira text-[var(--color-primary)] group-hover:text-[var(--color-primary-hover)] transition-colors'>
                            Bad
                        </div>
                    </div>
                    <div 
                        className='flex flex-col items-center gap-[var(--px-10)] group cursor-pointer'
                        onClick={() => handleRatingSelect('fine')}
                        onMouseEnter={() => setHoveredRating('fine')}
                        onMouseLeave={() => setHoveredRating(null)}
                    >
                        <FineIcon 
                            className='w-[var(--px-45)] h-[var(--px-45)] transition-colors' 
                            selected={selectedRating === 'fine'}
                            color={getIconColor('fine')}
                        />
                        <div className='text-[length:var(--px-9)] font-light leading-[var(--px-12)] font-fira text-[var(--color-primary)] group-hover:text-[var(--color-primary-hover)] transition-colors'>
                            Fine
                        </div>
                    </div>
                    <div 
                        className='flex flex-col items-center gap-[var(--px-10)] group cursor-pointer'
                        onClick={() => handleRatingSelect('good')}
                        onMouseEnter={() => setHoveredRating('good')}
                        onMouseLeave={() => setHoveredRating(null)}
                    >
                        <GoodIcon 
                            className='w-[var(--px-45)] h-[var(--px-45)] transition-colors' 
                            selected={selectedRating === 'good'}
                            color={getIconColor('good')}
                        />
                        <div className='text-[length:var(--px-9)] font-light leading-[var(--px-12)] font-fira text-[var(--color-primary)] group-hover:text-[var(--color-primary-hover)] transition-colors'>
                            Good
                        </div>
                    </div>
                    <div 
                        className='flex flex-col items-center gap-[var(--px-10)] group cursor-pointer'
                        onClick={() => handleRatingSelect('fire')}
                        onMouseEnter={() => setHoveredRating('fire')}
                        onMouseLeave={() => setHoveredRating(null)}
                    >
                        <FireIcon 
                            className='w-[var(--px-45)] h-[var(--px-45)] transition-colors' 
                            selected={selectedRating === 'fire'}
                            color={getIconColor('fire')}
                        />
                        <div className='text-[length:var(--px-9)] font-light leading-[var(--px-12)] font-fira text-[var(--color-primary)] group-hover:text-[var(--color-primary-hover)] transition-colors'>
                            Fire
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-start gap-[var(--px-10)] w-full">
                    <div className="text-[length:var(--px-11)] font-medium leading-[var(--px-16)] font-fira">
                    Share your experience <span className="text-[length:var(--px-10)] opacity-80 font-extralight">(optional)</span>
                    </div>
                    <textarea
                        className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-10)] font-light font-helvetica"
                        rows={4}
                        placeholder="Please describe your rating or feedback in detail..."
                    />
                </div>

                <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)]">
                    <ButtonSleek text="Submit Feedback" onClick={onClose} />
                    <ButtonSleek text="Cancel" onClick={onClose} transparent={true} />
                </div>
            </div>
        </div>
    )
}

export default PlaylistRating
