<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/">
        <table class="bestiario-table">
            <tr><th>Nome</th><th>Grado di Sfida</th><th>Tipo</th></tr>
            <xsl:for-each select="bestiario/mostro">
                <tr>
                    <td><xsl:value-of select="nome"/></td>
                    <td><xsl:value-of select="sfida"/></td>
                    <td><xsl:value-of select="tipo"/></td>
                </tr>
            </xsl:for-each>
        </table>
    </xsl:template>
</xsl:stylesheet>