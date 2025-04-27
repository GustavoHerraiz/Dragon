export default {
    transform: {},
    extensionsToTreatAsEsm: ['.js'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    testEnvironment: 'node',
    // Solo ejecutar tests en el directorio __tests__
    roots: ['<rootDir>/__tests__']
};
