<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/">
        <table class="bestiario-table" style="width: 100%; border-collapse: collapse;">
            <tr>
                <th style="padding: 10px; background: #8b1a1a; color: white; border: 1px solid #444;">Mostro (Clicca per espandere)</th>
                <th style="padding: 10px; background: #8b1a1a; color: white; border: 1px solid #444; width: 100px;">GS</th>
                <th style="padding: 10px; background: #8b1a1a; color: white; border: 1px solid #444; width: 150px;">Tipo</th>
            </tr>
            <xsl:for-each select="bestiario/mostro">
                <!-- Riga cliccabile -->
                <tr style="cursor: pointer; background: rgba(139,26,26,0.1); transition: 0.2s;" onclick="espandiMostro(this)">
                    <td style="padding: 15px; border: 1px solid #444; font-weight: bold; color: #e8c97e; font-size: 1.1rem;"><xsl:value-of select="nome"/></td>
                    <td style="padding: 15px; border: 1px solid #444; text-align: center;"><xsl:value-of select="sfida"/></td>
                    <td style="padding: 15px; border: 1px solid #444; text-align: center;"><xsl:value-of select="tipo"/></td>
                </tr>
                
                <!-- Dettaglio Nascosto (Il vero e proprio Layout del Manuale dei Mostri) -->
                <tr class="mostro-dettagli" style="display: none; background: #111;">
                    <td colspan="3" style="padding: 20px; border: 1px solid #444;">
                        
                        <div style="display: flex; gap: 20px; align-items: flex-start;">
                            <!-- Colonna Sinistra: Avatar del Mostro (Max 30% dello spazio) -->
                            <div style="flex: 0 0 30%;">
                                <img src="{avatar}" style="width: 100%; border: 2px solid #8b1a1a; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);"/>
                            </div>
                            
                            <!-- Colonna Destra: Statistiche verticali -->
                            <div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
                                <xsl:if test="stats1 != ''">
                                    <img src="{stats1}" style="width: 100%; border-radius: 6px;"/>
                                </xsl:if>
                                <xsl:if test="stats2 != ''">
                                    <img src="{stats2}" style="width: 100%; border-radius: 6px;"/>
                                </xsl:if>
                            </div>
                        </div>

                    </td>
                </tr>
            </xsl:for-each>
        </table>
    </xsl:template>
</xsl:stylesheet>