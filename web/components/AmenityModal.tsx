"use client";

import { X } from "lucide-react";
import { Modal } from "./ui/Modal";
import { C, FH, FB, AMENITY_INFO, type AmenityKey, type Institution } from "@/lib/data";
import { useT } from "@/lib/i18n";

export function AmenityModal({
  amenity,
  inst,
  onClose,
}: {
  amenity: AmenityKey | null;
  inst: Institution;
  onClose: () => void;
}) {
  const t = useT();
  const info = amenity ? AMENITY_INFO[amenity] : null;
  const Icon = info?.icon;

  return (
    <Modal open={!!info} onClose={onClose} maxWidth={440}>
      {info && (
        <div style={{ padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: `${C.teal}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {Icon && <Icon size={24} style={{ color: C.teal }}/>}
            </div>
            <button onClick={onClose} aria-label={t("common.back")} style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", padding: 6 }}>
              <X size={20} />
            </button>
          </div>

          <h3 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: C.text, marginTop: 16, lineHeight: 1.25 }}>
            {t(info.title)}
          </h3>
          <p style={{ fontFamily: FB, fontSize: 14.5, color: C.sub, marginTop: 10, lineHeight: 1.65 }}>{t(info.desc)}</p>

          {amenity === "transport" && inst.transportInfo && (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: FH, marginBottom: 6 }}>
                  {t({ ru: "Типы транспорта", tg: "Намудҳои нақлиёт" })}
                </p>
                {inst.transportInfo.types.map((tp) => (
                  <p key={tp.ru} style={{ fontSize: 13.5, color: C.text, marginBottom: 3 }}>• {t(tp)}</p>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: FH, marginBottom: 6 }}>
                  {t({ ru: "Районы охвата", tg: "Ноҳияҳои фарогирӣ" })}
                </p>
                <p style={{ fontSize: 13.5, color: C.text }}>{inst.transportInfo.areas.map((a) => t(a)).join(", ")}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: FH, marginBottom: 6 }}>
                  {t({ ru: "Стоимость", tg: "Нарх" })}
                </p>
                <p style={{ fontSize: 13.5, color: C.text }}>{inst.transportInfo.cost} {t("common.perMonth")}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
