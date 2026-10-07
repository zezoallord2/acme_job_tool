export function SkipLink() {
  return (
    <a
      href="#main"
      className="focus:bg-navy-900 sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-full focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
    >
      Skip to main content
    </a>
  );
}

export default SkipLink;
