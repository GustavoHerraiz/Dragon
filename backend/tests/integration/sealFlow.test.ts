import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import { join } from 'path';
import { logger } from '../../src/utils/logger.js';
import FibonacciAureoSeal from '../../src/seals/FibonacciAureoSeal.js';
import { analizar } from '../../src/analyzers/FirmasDigitales.js';

describe('Dragon Seal Flow', () => {
    const TEST_IMAGE = '/var/www/ProyectoDragon/test/fixtures/accionpoetica.jpg';
    const SEAL_OUTPUT = '/var/www/ProyectoDragon/test/fixtures/sealed';
    const MBH_ID = '12345';

    let sealedImagePath: string;

    it('should seal and verify image successfully', async () => {
        try {
            // 1. Seal image
            const sealer = new FibonacciAureoSeal({
                inputPath: TEST_IMAGE,
                outputDir: SEAL_OUTPUT,
                mbhId: MBH_ID
            });
            
            sealedImagePath = await sealer.seal();
            
            // 2. Verify sealed image
            const resultado = await analizar(sealedImagePath);
            
            // 3. Check results
            expect(resultado.score).to.equal(10);
            expect(resultado.detalles.esLegitimo).to.equal(1);
            expect(resultado.detalles.mensaje).to.include('MBH-12345');
            
            logger.info('Test completed successfully', {
                originalImage: TEST_IMAGE,
                sealedImage: sealedImagePath,
                score: resultado.score
            });

        } catch (error) {
            logger.error('Test failed', { error: error.message });
            throw error;
        }
    });
});
