import { ButtonSleek } from "../index";

export default function ErrorContent() {
  return (
    <div className="w-full flex flex-col items-center text-[var(--color-primary)] pt-[var(--px-120)]">
      <div className="max-w-[var(--px-650)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)]">
        <div className="flex flex-col items-center w-full gap-[var(--px-20)]">
          <svg className="w-[var(--px-35)] h-[var(--px-35)]" viewBox="0 0 19 19" fill="none">
            <path d="M17.8337 17.8333L1.16699 1.16667M17.8337 1.16667L1.16699 17.8333" stroke="white" stroke-linecap="round" stroke-linejoin="round" />
          </svg>

          <div className="text-center text-[length:var(--px-19)] font-semibold font-helvetica leading-[var(--px-23)] uppercase">Oops! Something went wrong.</div>
          <div className="text-center text-[length:var(--px-11)] font-light font-fira leading-[var(--px-18)] mb-[var(--px-20)]">No track data found. Please go back and try again.<br />This could happen if you navigated to this page directly without providing a track.</div>
          <ButtonSleek text="Upload Another Track" onClick={() => { window.location.href = "/upload"; }} />
        </div>
      </div>
    </div>
  );
}
