
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { MobileHeader } from "@/components/MobileHeader";
import { Footer } from "@/components/Footer";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";

export default function PrivacyTerms() {
  const { language } = useTheme();

  return (
    <div className="mobile-container">
      <MobileHeader title={t("privacyAndTerms", language)} showBackButton={true}>
        <ThemeLanguageToggle />
      </MobileHeader>
      
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 space-y-6">
          <div className="prose prose-sm max-w-none">
            <p className="text-sm text-muted-foreground mb-6">
              {t("lastUpdated", language)}: {t("june11_2025", language)}
            </p>

            <div className="space-y-6">
              <section>
                <h2 className="text-lg font-semibold mb-3">{t("legalCompliance", language)}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("legalComplianceText", language)}
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">{t("dataPrivacy", language)}</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">{t("whatWeCollect", language)}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t("whatWeCollectText", language)}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">{t("howItsUsed", language)}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t("howItsUsedText", language)}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">{t("dataSharing", language)}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t("dataSharingText", language)}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">{t("yourRights", language)}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t("yourRightsText", language)}
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">{t("responsibleUse", language)}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("responsibleUseText", language)}
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">{t("aiLimitations", language)}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("aiLimitationsText", language)}
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">{t("subscriptionRefunds", language)}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("subscriptionRefundsText", language)}
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">{t("contactInfo", language)}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("contactInfoText", language)}
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
