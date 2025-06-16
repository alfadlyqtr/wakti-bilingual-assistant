
import { useTheme } from "@/providers/ThemeProvider";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { MobileHeader } from "@/components/MobileHeader";
import { Footer } from "@/components/Footer";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";

export default function PrivacyTerms() {
  const { language } = useTheme();
  const navigate = useNavigate();

  const handleBackClick = () => {
    navigate("/home");
  };

  const formatText = (text: string) => {
    return text.split('\n').map((line, index) => (
      <div key={index} className="mb-1">
        {line}
      </div>
    ));
  };

  return (
    <div className="mobile-container">
      <MobileHeader 
        title={t("privacyAndTerms", language)} 
        showBackButton={true}
        onBackClick={handleBackClick}
      >
        <ThemeLanguageToggle />
      </MobileHeader>
      
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-center">
              {t("privacyPolicyHeader", language)}
            </h1>
            <p className="text-sm text-muted-foreground">
              <strong>{t("lastUpdated", language)}:</strong> {t("lastUpdatedDate", language)}
            </p>
            <div className="text-sm leading-relaxed text-muted-foreground border-l-4 border-primary pl-4 bg-muted/30 p-4 rounded-r-lg">
              {t("welcomeText", language)}
            </div>
          </div>

          <div className="space-y-8">
            {/* Section 1 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section1Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section1Text", language)}</p>
                <p className="text-sm leading-relaxed font-medium text-accent-foreground">
                  {t("section1Text2", language)}
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section2Title", language)}
              </h2>
              
              <div className="space-y-4">
                <div className="bg-muted/20 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 text-primary">{t("section2_1Title", language)}</h3>
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section2_1Text", language))}
                  </div>
                </div>

                <div className="bg-muted/20 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 text-primary">{t("section2_2Title", language)}</h3>
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section2_2Text", language))}
                  </div>
                </div>

                <div className="bg-muted/20 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 text-primary">{t("section2_3Title", language)}</h3>
                  <div className="space-y-2 text-sm leading-relaxed">
                    <p>{t("section2_3Text", language)}</p>
                    <p>{t("section2_3Text2", language)}</p>
                    <p className="font-medium">{t("section2_3Text3", language)}</p>
                  </div>
                </div>

                <div className="bg-muted/20 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 text-primary">{t("section2_4Title", language)}</h3>
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section2_4Text", language))}
                  </div>
                </div>

                <div className="bg-muted/20 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 text-primary">{t("section2_5Title", language)}</h3>
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section2_5Text", language))}
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section3Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section3Text", language)}</p>
                <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section3List", language))}
                  </div>
                </div>
                <div className="bg-red-100 dark:bg-destructive/20 p-3 rounded-lg">
                  <p className="text-sm font-bold text-red-800 dark:text-destructive-foreground">
                    {t("section3Warning", language)}
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section4Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed font-medium">{t("section4Text", language)}</p>
                <div className="bg-muted/20 p-4 rounded-lg">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section4List", language))}
                  </div>
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section5Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section5Text", language)}</p>
                <p className="text-sm leading-relaxed font-medium">{t("section5Text2", language)}</p>
                <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section5List", language))}
                  </div>
                </div>
              </div>
            </section>

            {/* Section 6 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section6Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section6Text", language)}</p>
                <div className="bg-yellow-50 dark:bg-yellow-950/30 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section6List", language))}
                  </div>
                </div>
                <div className="bg-red-100 dark:bg-destructive/20 p-3 rounded-lg">
                  <p className="text-sm font-bold text-red-800 dark:text-destructive-foreground">
                    {t("section6Warning", language)}
                  </p>
                </div>
              </div>
            </section>

            {/* Section 7 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section7Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section7Text", language)}</p>
                <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section7List", language))}
                  </div>
                </div>
                <div className="bg-red-100 dark:bg-destructive/20 p-3 rounded-lg">
                  <p className="text-sm font-bold text-red-800 dark:text-destructive-foreground">
                    {t("section7Warning", language)}
                  </p>
                </div>
              </div>
            </section>

            {/* Section 8 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section8Title", language)}
              </h2>
              <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-sm leading-relaxed">
                  {formatText(t("section8List", language))}
                </div>
              </div>
            </section>

            {/* Section 9 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section9Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section9Text", language)}</p>
                <div className="bg-muted/20 p-4 rounded-lg">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section9List", language))}
                  </div>
                </div>
                <div className="bg-red-100 dark:bg-destructive/20 p-3 rounded-lg">
                  <p className="text-sm font-bold text-red-800 dark:text-destructive-foreground">
                    {t("section9Warning", language)}
                  </p>
                </div>
              </div>
            </section>

            {/* Section 10 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section10Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section10Text", language)}</p>
                <div className="bg-muted/20 p-4 rounded-lg">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section10List", language))}
                  </div>
                </div>
              </div>
            </section>

            {/* Section 11 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section11Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section11Text", language)}</p>
                <div className="bg-muted/20 p-4 rounded-lg">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section11List", language))}
                  </div>
                </div>
                <div className="bg-red-100 dark:bg-destructive/20 p-3 rounded-lg">
                  <p className="text-sm font-bold text-red-800 dark:text-destructive-foreground">
                    {t("section11Warning", language)}
                  </p>
                </div>
              </div>
            </section>

            {/* Section 12 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section12Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section12Text", language)}</p>
                <div className="bg-muted/20 p-4 rounded-lg">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section12List", language))}
                  </div>
                </div>
              </div>
            </section>

            {/* Section 13 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section13Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section13Text", language)}</p>
                <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 text-center">
                  <p className="text-lg font-bold text-red-700 dark:text-primary">
                    {t("section13Contact", language)}
                  </p>
                </div>
              </div>
            </section>

            {/* Footer */}
            <section className="border-t pt-6 space-y-4">
              <div className="bg-muted/30 p-6 rounded-lg space-y-4">
                <blockquote className="text-sm leading-relaxed italic border-l-4 border-primary pl-4">
                  {t("footerQuote", language)}
                </blockquote>
                <div className="text-center space-y-2">
                  <p className="font-bold text-red-700 dark:text-primary">
                    {t("footerCopyright", language)}
                  </p>
                  <p className="text-sm font-bold text-red-600 dark:text-accent-foreground">
                    {t("footerWarning", language)}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
