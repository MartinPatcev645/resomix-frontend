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
 * Clicking the group opens the Creative Commons license page in a new tab.
 */
export function CCLicenseGroup({
    size = 16,
    className = '',
}: CCLicenseGroupProps) {
    const { ccLicenseUrl } = useConfig();

    return (
        <a
            href={ccLicenseUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Creative Commons BY-NC-SA 3.0 License"
            className={`inline-flex items-center gap-[var(--px-2)] transition-opacity hover:opacity-70 hover:cursor-pointer ${className}`.trim()}
        >
            <img
                src={CCSvg}
                alt="Creative Commons"
                draggable={false}
                className="cc-license-icon"
                style={{ width: `var(--px-${size})`, height: `var(--px-${size})`, filter: 'invert(1)' }}
            />
            <img
                src={LittleManSvg}
                alt="Attribution"
                draggable={false}
                className="cc-license-icon"
                style={{ width: `var(--px-${size})`, height: `var(--px-${size})`, filter: 'invert(1)' }}
            />
            <img
                src={NoDollarSvg}
                alt="NonCommercial"
                draggable={false}
                className="cc-license-icon"
                style={{ width: `var(--px-${size})`, height: `var(--px-${size})`, filter: 'invert(1)' }}
            />
            <img
                src={RoundArrowSvg}
                alt="ShareAlike"
                draggable={false}
                className="cc-license-icon"
                style={{ width: `var(--px-${size})`, height: `var(--px-${size})`, filter: 'invert(1)' }}
            />
        </a>
    );
}

export default CCLicenseGroup;
