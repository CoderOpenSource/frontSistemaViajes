export default function Footer() {
    return (
        <footer className="border-t bg-white">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm">
                <small className="text-gray-600">© {new Date().getFullYear()} Serrano del Oriente</small>
                <nav className="flex gap-3">
                    <a className="text-gray-600 hover:text-gray-900" href="#">Términos</a>
                    <a className="text-gray-600 hover:text-gray-900" href="#">Privacidad</a>
                </nav>
            </div>
        </footer>
    );
}
