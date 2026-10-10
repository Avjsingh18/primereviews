import QRPage from "../../components/qr-page";
import QrStudioPage from "../../components/qr-studio-page";
import { qrStudioEnabled } from "@/lib/qr-studio";
export default function QRCodePage() { return qrStudioEnabled() ? <QrStudioPage /> : <QRPage />; }
