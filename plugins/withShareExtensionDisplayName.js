// HAKO — Nom affiché de l'extension de partage iOS
// expo-share-intent utilise le même réglage pour le nom de la cible Xcode et
// le nom affiché ; « Hako » entrerait en conflit avec le dossier de l'app.
// On garde la cible par défaut (« ShareExtension ») et on affiche « Hako »
// dans le menu Partager en réécrivant CFBundleDisplayName de l'extension.
// expo-share-intent écrit ce fichier pendant le mod « xcodeProject » ; on
// s'y branche aussi, déclaré AVANT lui dans app.json pour passer après.
const fs = require('fs');
const path = require('path');
const { withXcodeProject } = require('expo/config-plugins');

module.exports = function withShareExtensionDisplayName(config, { displayName = 'Hako' } = {}) {
  return withXcodeProject(config, async cfg => {
    const plist = path.join(cfg.modRequest.platformProjectRoot, 'ShareExtension', 'ShareExtension-Info.plist');
    if (fs.existsSync(plist)) {
      const xml = fs.readFileSync(plist, 'utf8').replace(
        /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/,
        `$1${displayName}$2`,
      );
      fs.writeFileSync(plist, xml);
    }
    return cfg;
  });
};
