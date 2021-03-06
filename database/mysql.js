/**
 * Created by ChengZheLin on 2018/7/20.
 */

const mysql = require('mysql2/promise');
const { database } = require('../config');

async function query(sql, cb) {
    const connection = await mysql.createConnection({
        ...database
    });

    let [rows] = await connection.execute(sql);


    rows = JSON.stringify(rows);
    rows = rows.replace(/\\"/img, '"').replace(/"{/img, '{').replace(/}"/img, '}');

    if (typeof cb === 'function') {
        return await cb(JSON.parse(rows), connection)
    } else {
        connection.end();
        return JSON.parse(rows)
    }
}

// 清洗数据
function cleanData(val) {
    let rows = JSON.stringify(val);
    rows = rows.replace(/\\"/img, '"').replace(/"{/img, '{').replace(/}"/img, '}');
    return JSON.parse(rows)[0]
}

// 查询成员信息
async function queryMemberInfo(id) {
    if (id === 'all') id = null;

    let data = {};
    let date = parseInt(new Date().getTime() / 1000, 10);
    let sql = `SELECT 
                rg_member.id, 
                rg_member.name, 
                rg_member.head_pic, 
                rg_member.weibo_index_id, 
                
                UNIX_TIMESTAMP(rg_hour.create_date) AS create_hour,
                rg_hour.baike_browse,
                rg_hour.baike_flowers,
                rg_hour.weibo_forward,
                rg_hour.weibo_comment,
                rg_hour.weibo_like,
                rg_hour.weibo_fans,
                rg_hour.doki_fans,
                rg_hour.doki_popularity,
                rg_hour.doki_rank,
                rg_hour.super_rank,
                rg_hour.super_read,
                rg_hour.super_post,
                rg_hour.super_fans,
                
                UNIX_TIMESTAMP(rg_day.create_date) AS create_day,
                rg_day.weibo_index,
                rg_day.weibo_ring,
                rg_day.weibo_total,
                rg_day.weibo_read,
                rg_day.weibo_int,
                rg_day.weibo_inf,
                rg_day.weibo_love
                
                FROM laimeiyun_data.rg_member AS rg_member, 
                laimeiyun_data.rg_day AS rg_day, 
                laimeiyun_data.rg_hour AS rg_hour
                WHERE rg_member.id = rg_hour.id
                AND rg_member.id = rg_day.id
                AND UNIX_TIMESTAMP(rg_hour.create_date) > ${date - 7200}
				AND UNIX_TIMESTAMP(rg_day.create_date) > ${date - 86400}   
                ${ id ? 'AND rg_member.id = ' + id : '' }
                ORDER BY rg_day.create_date desc, rg_hour.create_date desc, rg_member.id asc
                LIMIT ${ id ? 1 : 11 }`;

    data.list = await query(sql, async (items, connection) => {
        let saveData = items.map(async item => {
            let queryHourItem = connection.execute(
                `SELECT 
                UNIX_TIMESTAMP(rg_hour.create_date) AS create_hour,
                rg_hour.baike_browse,
                rg_hour.baike_flowers,
                rg_hour.weibo_forward,
                rg_hour.weibo_comment,
                rg_hour.weibo_like,
                rg_hour.weibo_fans,
                rg_hour.doki_fans,
                rg_hour.doki_popularity,
                rg_hour.doki_rank,
                rg_hour.super_rank,
                rg_hour.super_read,
                rg_hour.super_post,
                rg_hour.super_fans
                FROM laimeiyun_data.rg_hour AS rg_hour
                WHERE rg_hour.id = ${item.id}
                AND UNIX_TIMESTAMP(rg_hour.create_date) > ${date - 345600}   
                ORDER BY rg_hour.create_date desc
                LIMIT 1,1`
            );
            let queryDayItem = connection.execute(
                `SELECT
                UNIX_TIMESTAMP(rg_day.create_date) AS create_day,
                 rg_day.weibo_index,
                rg_day.weibo_ring,
                rg_day.weibo_total,
                rg_day.weibo_read,
                rg_day.weibo_int,
                rg_day.weibo_inf,
                rg_day.weibo_love
                FROM laimeiyun_data.rg_day AS rg_day
                WHERE rg_day.id = ${item.id}
                AND UNIX_TIMESTAMP(rg_day.create_date) > ${date - 345600}   
                ORDER BY rg_day.create_date desc
                LIMIT 1,1`
            );
            let [hourRows] = cleanData(await queryHourItem);
            let [dayRows] = cleanData(await queryDayItem);

            let rows = {
                ...hourRows,
                ...dayRows
            };

            item.prev_data = rows;
            return item
        });
        let saveList = [];
        for (const itemPromise of saveData) {
            saveList.push(await itemPromise)
        }
        connection.end();
        return saveList;
    });
    return data
}

// 查询成员基本信息
async function queryMemberBase(id) {
    if (id === 'all') id = null;
    let data = {};

    let sql = `SELECT *
                FROM laimeiyun_data.rg_member AS rg_member
                ${ id ? 'WHERE rg_member.id = ' + id : '' }
                LIMIT ${ id ? 1 : 11 }`;
    data.list = await query(sql);
    return data
}

// 查询成员每日数据
async function queryMemberDayData(id, type) {
    let page_size = 1;
    switch (type) {
        case 'month':
            page_size = 31;
            break;
        case 'week':
            page_size = 8;
            break;
    }

    let data = {};
    data['list'] = await query(
        `SELECT 
        id,
        UNIX_TIMESTAMP(create_date) AS create_date,
        weibo_ring,weibo_total,weibo_read,weibo_int,weibo_inf,weibo_love,weibo_index
        FROM laimeiyun_data.rg_day 
        WHERE id = ${id} 
        ORDER BY create_date desc 
        LIMIT 0,${page_size}`);

    return data
}

// 查询成员24/一个月小时数据
async function queryMemberHourData(id, type) {
    let data = {};
    if (type === 'day') {
        data['list'] = await query(
            `SELECT 
        id,
        UNIX_TIMESTAMP(create_date) AS create_date,
        baike_browse,
        baike_flowers,
        weibo_forward,
        weibo_comment,
        weibo_like,
        weibo_fans,
        doki_fans,
        doki_popularity,
        doki_rank,
        super_rank,
        super_read,
        super_post,
        super_fans
        FROM laimeiyun_data.rg_hour 
        WHERE id = ${id} 
        ORDER BY create_date desc LIMIT 0,25`
        );
    } else {
        data['list'] = await query(
            `SELECT 
             id,
        UNIX_TIMESTAMP(create_date) AS create_date,
        baike_browse,
        baike_flowers,
        weibo_forward,
        weibo_comment,
        weibo_like,
        weibo_fans,
        doki_fans,
        doki_popularity,
        doki_rank,
        super_rank,
        super_read,
        super_post,
        super_fans
        FROM laimeiyun_data.rg_hour
        WHERE id = ${id}
        AND DATE_FORMAT(create_date,'%H') = 23
        ORDER BY create_date desc
        LIMIT 31`
        );
    }
    return data
}

// 获取新星榜数据
async function queryNewStarData(type) {
    // new all
  let data = {};
  let sql  = '';

  if (type === 'new') {
    sql = `SELECT FROM_UNIXTIME(UNIX_TIMESTAMP(create_date) - 86400,'%Y年%m月%d日') AS create_date,
            name,rank,total,\`read\`,read_total,interactive,int_total,influences,inf_total,love,love_total
            FROM laimeiyun_data.rg_newstar AS rg_newstar
            WHERE 
            FROM_UNIXTIME(UNIX_TIMESTAMP(create_date) - 86400,'%m') = MONTH(CURDATE())
            ORDER BY create_date desc , rank asc
            LIMIT 50
            `;
  } else {
    sql = `SELECT FROM_UNIXTIME(UNIX_TIMESTAMP(create_date) - 86400,'%Y年%m月%d日') AS create_date,
            name,rank,total,\`read\`,read_total,interactive,int_total,influences,inf_total,love,love_total
            FROM laimeiyun_data.rg_newstar AS rg_newstar
            WHERE 
            FROM_UNIXTIME(UNIX_TIMESTAMP(create_date) - 86400,'%m') = MONTH(CURDATE())
            ORDER BY create_date desc , rank asc
            `;
  }
  return await query(sql);
}

module.exports = {
    query,
    queryMemberBase,
    queryMemberInfo,
    queryMemberDayData,
    queryMemberHourData,
    queryNewStarData
};

if (require.main === module) {
    (async () => {
        let data = await queryMemberInfo(1);
        console.log(data)
    })()
}