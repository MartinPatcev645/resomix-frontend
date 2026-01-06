import { Tooltip } from '@resomix/ui';
import { useConfig } from '@resomix/stores';
import CCSvg from '@/assets/icons/cc/cc.svg';
import LittleManSvg from '@/assets/icons/cc/little_man.svg';
import NoDollarSvg from '@/assets/icons/cc/no_dollar.svg';
import RoundArrowSvg from '@/assets/icons/cc/round_arrow.svg';

interface CCLicenseGroupProps {
    /**
     * Size of each icon (width and height in px). Defaults to 16.
     */
    size?: number;
    /**
     * Additional Tailwind / custom classes for the container.
     */
    className?: string;
}

/**
 * Creative Commons License Icon Group (CC BY-NC-SA 3.0).
 * Displays four icons horizontally: CC, Attribution (little man), NonCommercial (no dollar), ShareAlike (round arrow).
 * Each icon is independently clickable and hoverable.
 */
export function CCLicenseGroup({
    size = 16,
    className = '',
}: CCLicenseGroupProps) {
    const { ccLicenseUrl } = useConfig();

    const icons = [
        { src: CCSvg, alt: 'Creative Commons', label: 'Creative Commons' },
        { src: LittleManSvg, alt: 'Attribution', label: 'Attribution (BY)' },
        { src: NoDollarSvg, alt: 'NonCommercial', label: 'Non-Commercial (NC)' },
        { src: RoundArrowSvg, alt: 'ShareAlike', label: 'Share-Alike (SA)' },
    ];

    return (
        <div className={`inline-flex items-center gap-[var(--px-2)] ${className}`.trim()}>
            {icons.map((icon, index) => (
                <Tooltip key={index} message={icon.label}>
                    <a
                        href={ccLicenseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-opacity hover:opacity-70 hover:cursor-pointer flex items-center justify-center"
                        aria-label={icon.label}
                    >
                        <img
                            src={icon.src}
                            alt={icon.alt}
                            draggable={false}
                            className="cc-license-icon"
                            style={{
                                width: `var(--px-${size})`,
                                height: `var(--px-${size})`,
                                filter: 'invert(1)'
                            }}
                        />
                    </a>
                </Tooltip>
            ))}
        </div>
    );
}

export default CCLicenseGroup;
