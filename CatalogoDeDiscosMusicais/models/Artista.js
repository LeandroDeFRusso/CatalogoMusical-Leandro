import { DataTypes } from "sequelize";
import { sequelize } from "../dbConfig.js";

const Artista = sequelize.define('Artista', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
      nome: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
      generoMusical: {
        type: DataTypes.STRING,
        allowNull: false
    },
}, {
    tableName: 'Artista',
    timestamps: false
});

const createArtistaTable = async () => {
    try {
        await Artista.sync();
        console.log('Tabela Artista criada ou já existente no banco de dados!');
    } catch (err) {
        console.error('Erro ao sincronizar tabela para criação ou verificação da mesma:', err);
    }
};

const createArtista = async ({ nome, generos, discos }) => {
    const transaction = await sequelize.transaction();
    try {
        const generoMusical = generos.join(',');
        const novoArtista = await Artista.create(
            { nome, generoMusical },
            { transaction }
        );

        const discosArray = Array.isArray(discos) ? discos : [discos];

        if (discosArray.length > 0) {
            const query = `
                UPDATE Disco
                SET ArtistaFK = :id
                WHERE discoId IN (:discos);
            `;

            await sequelize.query(query, {
                replacements: {
                    id: novoArtista.id,
                    discos: discosArray,
                },
                transaction,
            });
        }
        await transaction.commit();
        return novoArtista;
    } catch (err) {
        await transaction.rollback();
        console.error('Erro ao salvar Artista:', err);
        throw err;
    }
};

const updateArtista = async (artistaId, nome, generoMusical) => {
    try {
        const generoMusicalString = Array.isArray(generoMusical) ? generoMusical.join(',') : generoMusical;
        await sequelize.query(
            `UPDATE Artista
             SET nome = :nome,
                 generoMusical = :generoMusical
             WHERE id = :artistaId`,
            {
                replacements: { artistaId, nome, generoMusical: generoMusicalString },
            }
        );
        return true;
    } catch (err) {
        console.error('Erro ao atualizar artista:', err);
        throw err;
    }
};


const findAllArtistas = async () => {
    try {
        const [results] = await sequelize.query(`
            SELECT 
                a.id AS artistaId,
                a.nome AS nomeArtista,
                a.generoMusical,
                d.discoId,
                d.titulo AS tituloDisco,
                d.anoLancamento,
                d.capa
            FROM Artista a
            LEFT JOIN Disco d ON a.id = d.artistaFK
        `);
        return results;
    } catch (err) {
        console.error('Erro ao buscar artistas:', err);
        throw err;
    }
};

const findAllArtista = async () => {
    const [artistas] = await sequelize.query(`
        SELECT 
            a.id AS artistaId,
            a.nome AS nomeArtista,
            a.generoMusical AS generoArtista
        FROM artista a
        LEFT JOIN Disco d ON a.id = d.artistaFk
        GROUP BY a.id, a.nome, a.generoMusical
    `);
    return artistas;
};

const deleteArtista = async (artistaId) => {
    const transaction = await sequelize.transaction();
    try {
        await sequelize.query(
            `UPDATE Disco
             SET artistaFK = NULL
             WHERE artistaFK = :artistaId`,
            {
                replacements: { artistaId },
                transaction,
            }
        );
        await sequelize.query(
            `DELETE FROM Artista
             WHERE id = :artistaId`,
            {
                replacements: { artistaId },
                transaction,
            }
        );
        await transaction.commit();
        return true;
    } catch (err) {
        await transaction.rollback();
        console.error('Erro ao excluir artista:', err);
        throw err;
    }
};

const findArtistaById = async (id) => {
    try {
        const [results] = await sequelize.query(`
            SELECT 
                a.id AS artistaId,
                a.nome AS nomeArtista,
                a.generoMusical,
                d.discoId,
                d.titulo AS tituloDisco,
                d.anoLancamento,
                d.capa
            FROM Artista a
            LEFT JOIN Disco d ON a.id = d.artistaFK
            WHERE a.id = :id
        `, {
            replacements: { id },
        });

        if (!results || results.length === 0) {
            return null;
        }
        const artista = {
            artistaId: results[0].artistaId,
            nomeArtista: results[0].nomeArtista,
            generoMusical: results[0].generoMusical,
            discos: results
                .filter(r => r.discoId)
                .map(disco => ({
                    discoId: disco.discoId,
                    tituloDisco: disco.tituloDisco,
                    anoLancamento: disco.anoLancamento,
                    capa: disco.capa,
                })),
        };
        return artista;
    } catch (err) {
        console.error('Erro ao buscar artista pelo Id:', err);
        throw err;
    }
};

const dissociarDiscos = async (artistaId) => {
    try {
        await sequelize.query(
            `UPDATE Disco
             SET artistaFK = NULL
             WHERE artistaFK = :artistaId`,
            {
                replacements: { artistaId },
            }
        );
    } catch (err) {
        console.error('Erro ao dissociar discos do Artista recebido:', err);
        throw err;
    }
};

const associarDiscos = async (artistaId, discos) => {
    try {
        await sequelize.query(
            `UPDATE Disco
             SET artistaFK = :artistaId
             WHERE discoId IN (:discos)`,
            {
                replacements: { artistaId, discos },
            }
        );
    } catch (err) {
        console.error('Erro ao associar discos ao Artista recebido:', err);
        throw err;
    }
};

const searchArtista = async ({ titulo, artista, genero, generoMusical }) => {
    const whereClauses = [];
    const replacements = {};

    if (titulo) {
        whereClauses.push('d.titulo LIKE :titulo');
        replacements.titulo = `%${titulo}%`;
    }
    if (artista) {
        whereClauses.push('a.nome LIKE :artista');
        replacements.artista = `%${artista}%`;
    }
    if (genero) {
        whereClauses.push('(g.genero LIKE :genero OR a.generoMusical LIKE :genero)');
        replacements.genero = `%${genero}%`;
    }
    if (generoMusical) {
        whereClauses.push('a.generoMusical LIKE :generoMusical');
        replacements.generoMusical = `%${generoMusical}%`;
    }
    const whereCondition = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const query = `
    SELECT 
        a.id AS artistaId,
        a.nome AS nomeArtista,
        a.generoMusical AS generoArtista,
        d.discoId,
        d.titulo AS discoTitulo,
        d.anoLancamento AS anoLancamentoDisco,
        d.capa AS capaDisco,
        GROUP_CONCAT(DISTINCT g.genero ORDER BY g.genero ASC SEPARATOR ', ') AS generoMusical,
        f.nome AS faixaNome,
        f.duracao AS faixaDuracao,
        f.audio AS faixaAudio
    FROM artista a
    LEFT JOIN Disco d ON a.id = d.artistaFk
    LEFT JOIN generomusical g ON d.discoId = g.discoFk
    LEFT JOIN faixa f ON d.discoId = f.discoFk
    ${whereCondition}
    GROUP BY a.id, a.nome, a.generoMusical, d.discoId, d.titulo, d.anoLancamento, d.capa, f.nome, f.duracao, f.audio
    `;
    try {
        const [results] = await sequelize.query(query, { replacements });
        return results;
    } catch (err) {
        console.error('Erro ao buscar discos com filtros:', err);
        throw err;
    }
};

const artistaModel = {
    createArtistaTable,
    createArtista,
    updateArtista,
    findAllArtistas,
    deleteArtista,
    findArtistaById,
    associarDiscos,
    dissociarDiscos,
    findAllArtista,
    searchArtista
};

export default artistaModel;
