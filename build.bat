heat dir "assets" -gg -sfrag -dr INSTALLDIR -cg Assets -out assets.wxs
heat dir "node_modules" -gg -sfrag -dr INSTALLDIR -cg NodeModules -out node_modules.wxs
candle karaokyo.xml assets.wxs node_modules.wxs
light -ext WixUIExtension karaokyo.wixobj assets.wixobj node_modules.wixobj -out karaokyo.msi -b assets -b node_modules