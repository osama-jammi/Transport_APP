const fs = require('fs');
const path = require('path');

const filePath = 'C:/Users/user/OneDrive/Masaüstü/DivNet-CAISSE/Transport-Livraison/Transport-BackEnd/src/main/java/com/agileo/transport/service/impl/RapportServiceImpl.java';

let content = fs.readFileSync(filePath, 'utf-8');

// 1. Update header styles
content = content.replace(/style\.setFillForegroundColor\(IndexedColors\.LIGHT_BLUE\.getIndex\(\)\);/g, 
  'font.setColor(IndexedColors.WHITE.getIndex());\n        style.setFillForegroundColor(IndexedColors.TEAL.getIndex());');

content = content.replace(/s\.setFillForegroundColor\(IndexedColors\.LIGHT_BLUE\.getIndex\(\)\);/g, 
  'f.setColor(IndexedColors.WHITE.getIndex());\n        s.setFillForegroundColor(IndexedColors.TEAL.getIndex());');

// 2. Insert logo method before the last brace
const logoMethod = `
    private void insertLogo(Workbook wb, Sheet sheet) {
        try {
            java.io.InputStream is = getClass().getResourceAsStream("/reports/riche-bois-logo.jpg");
            if (is == null) return;
            byte[] bytes = org.apache.poi.util.IOUtils.toByteArray(is);
            int pictureIdx = wb.addPicture(bytes, Workbook.PICTURE_TYPE_JPEG);
            is.close();

            CreationHelper helper = wb.getCreationHelper();
            Drawing<?> drawing = sheet.createDrawingPatriarch();
            ClientAnchor anchor = helper.createClientAnchor();
            // Position logo flexibly far right
            anchor.setCol1(sheet.getRow(0) != null ? sheet.getRow(0).getLastCellNum() + 1 : 5);
            anchor.setRow1(0);
            Picture pict = drawing.createPicture(anchor, pictureIdx);
            pict.resize(1.2, 1.2);
        } catch (Exception e) {
            // ignore
        }
    }
}
`;
content = content.replace(/}\s*$/, logoMethod);

// 3. Append insertLogo call after each autoSize call
// Use regex replace with callback
content = content.replace(/autoSize\(([^,]+),\s*([^)]+)\);/g, (match, sheetVar, cols) => {
  return `autoSize(${sheetVar}, ${cols});\n            insertLogo(wb, ${sheetVar});`;
});

fs.writeFileSync(filePath, content, 'utf-8');
console.log('RapportServiceImpl updated.');
