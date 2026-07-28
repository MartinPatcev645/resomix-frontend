import { Tooltip } from '@resomix/ui';

interface CCLicenseGroupProps {
    /**
     * Size of each icon (height in px, width will auto-scale). Defaults to 16.
     */
    size?: number;
    /**
     * Additional Tailwind / custom classes for the container.
     */
    className?: string;
}

/**
 * Creative Commons License Icon Group.
 * Displays three icons horizontally: CC BY 4.0, CC0 1.0, and Public Domain Mark 1.0.
 * Each icon is independently clickable and hoverable.
 */
export function CCLicenseGroup({
    size = 16,
    className = '',
}: CCLicenseGroupProps) {
    const icons = [
        {
            href: "https://creativecommons.org/licenses/by/4.0/",
            src: "https://licensebuttons.net/l/by/4.0/88x31.png",
            alt: "Creative Commons License",
            label: "Creative Commons License (BY 4.0)"
        },
        {
            href: "https://creativecommons.org/publicdomain/zero/1.0/",
            src: "https://licensebuttons.net/l/zero/1.0/88x31.png",
            alt: "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication",
            label: "CC0 1.0 Universal"
        },
        {
            href: "https://creativecommons.org/publicdomain/mark/1.0/",
            src: "https://licensebuttons.net/p/mark/1.0/88x31.png",
            alt: "Public Domain Mark 1.0",
            label: "Public Domain Mark 1.0"
        }
    ];

    return (
        <div className={`inline-flex items-center gap-[var(--px-3)] ${className}`.trim()}>
            {icons.map((icon, index) => (
                <Tooltip key={index} message={icon.label}>
                    <a
                        href={icon.href}
                        target="_blank"
                        rel="license noopener noreferrer"
                        className="transition-opacity hover:opacity-70 hover:cursor-pointer flex items-center justify-center"
                        aria-label={icon.label}
                    >
                        <img
                            src={icon.src}
                            alt={icon.alt}
                            draggable={false}
                            width={88}
                            height={31}
                            className="cc-license-icon aspect-[88/31]"
                            style={{
                                height: `var(--px-${size})`,
                                width: 'auto',
                                borderWidth: 0
                            }}
                        />
                    </a>
                </Tooltip>
            ))}
        </div>
    );
}

export default CCLicenseGroup;
